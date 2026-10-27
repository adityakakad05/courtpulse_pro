
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    match: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    tournament: {
      findUnique: vi.fn(),
    },
    tournamentParticipant: {
      findMany: vi.fn(),
    },
    scoringEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../db.js", () => ({
  prisma: prismaMock,
}));

import matchesRouter from "./matches.js";

const app = express();
app.use(express.json());
app.use("/api/matches", matchesRouter);

describe("Match route tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a match where both player IDs are identical", async () => {
    const response = await request(app)
      .post("/api/matches")
      .send({
        tournamentId: "tournament-1",
        playerOneId: "player-1",
        playerTwoId: "player-1",
        bestOf: 3,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid match data");
    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an invalid bestOf value", async () => {
    const response = await request(app)
      .post("/api/matches")
      .send({
        tournamentId: "tournament-1",
        playerOneId: "player-1",
        playerTwoId: "player-2",
        bestOf: 2,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid match data");
    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an invalid winnerSide before database access", async () => {
    const response = await request(app)
      .post("/api/matches/match-1/points")
      .send({
        winnerSide: 2,
        expectedVersion: 0,
      });

    expect(response.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a stale version when starting a match", async () => {
    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: any) => Promise<unknown>) => {
        const tx = {
          match: {
            findUnique: vi.fn().mockResolvedValue({
              id: "match-1",
              status: "SCHEDULED",
              version: 5,
              scoreState: null,
            }),
          },
        };

        return callback(tx);
      },
    );

    const response = await request(app)
      .post("/api/matches/match-1/start")
      .send({ expectedVersion: 4 });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Match changed. Refresh the score and try again.",
    );
  });

  it("starts a scheduled match and records an audit event", async () => {
    const match = {
      id: "match-1",
      status: "SCHEDULED",
      version: 0,
      scoreState: null,
      bestOf: 3,
      playerOneId: "player-1",
      playerTwoId: "player-2",
    };

    const updatedMatch = {
      ...match,
      status: "LIVE",
      version: 1,
    };

    const tx = {
      match: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(match)
          .mockResolvedValueOnce(updatedMatch),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      scoringEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: any) => Promise<unknown>) => callback(tx),
    );

    const response = await request(app)
      .post("/api/matches/match-1/start")
      .send({ expectedVersion: 0 });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("LIVE");
    expect(response.body.data.version).toBe(1);
    expect(response.headers.etag).toBe('"1"');

    expect(tx.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "match-1",
          version: 0,
          status: "SCHEDULED",
        }),
      }),
    );

    expect(tx.scoringEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchId: "match-1",
          sequence: 1,
          type: "MATCH_STARTED",
        }),
      }),
    );
  });

  it("awards a point and records the updated score", async () => {
    const initialState = {
      games: [],
      currentGame: 1,
      points: [0, 0],
      gamesWon: [0, 0],
      servingSide: 0,
      matchFinished: false,
    };

    const match = {
      id: "match-1",
      status: "LIVE",
      version: 1,
      scoreState: initialState,
      bestOf: 3,
      playerOneId: "player-1",
      playerTwoId: "player-2",
    };

    const updatedMatch = {
      ...match,
      version: 2,
      scoreState: {
        ...initialState,
        points: [1, 0],
        servingSide: 0,
      },
    };

    const tx = {
      match: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(match)
          .mockResolvedValueOnce(updatedMatch),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      scoringEvent: {
        findFirst: vi.fn().mockResolvedValue({
          sequence: 1,
        }),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: any) => Promise<unknown>) => callback(tx),
    );

    const response = await request(app)
      .post("/api/matches/match-1/points")
      .send({
        winnerSide: 0,
        expectedVersion: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.scoreState.points).toEqual([1, 0]);
    expect(response.body.data.version).toBe(2);
    expect(response.body.matchFinished).toBe(false);
    expect(response.headers.etag).toBe('"2"');

    expect(tx.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "match-1",
          version: 1,
          status: "LIVE",
        }),
        data: expect.objectContaining({
          version: { increment: 1 },
        }),
      }),
    );

    expect(tx.scoringEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchId: "match-1",
          sequence: 2,
          type: "POINT_AWARDED",
          pointWinnerId: "player-1",
          beforeState: initialState,
          afterState: updatedMatch.scoreState,
        }),
      }),
    );
  });
});
