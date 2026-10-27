
import type { Prisma } from "../../generated/prisma/client.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  awardPoint,
  initialScoreState,
  type ScoreState,
} from "../services/scoring.js";

const router = Router();

const createMatchSchema = z
  .object({
    tournamentId: z.string().min(1),
    playerOneId: z.string().min(1),
    playerTwoId: z.string().min(1),
    bestOf: z
      .union([z.literal(1), z.literal(3), z.literal(5)])
      .default(3),
  })
  .refine((data) => data.playerOneId !== data.playerTwoId, {
    message: "A player cannot play against themselves",
    path: ["playerTwoId"],
  });

const pointSchema = z.object({
  winnerSide: z.union([z.literal(0), z.literal(1)]),
  expectedVersion: z.number().int().nonnegative(),
});

const versionSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

function readScoreState(value: unknown): ScoreState {
  const schema = z.object({
    games: z.array(
      z.object({
        playerOne: z.number().int().nonnegative(),
        playerTwo: z.number().int().nonnegative(),
      }),
    ),
    currentGame: z.number().int().positive(),
    points: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),
    gamesWon: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),
    servingSide: z.union([z.literal(0), z.literal(1)]),
    matchFinished: z.boolean().optional(),
  });

  const parsed = schema.safeParse(value ?? initialScoreState());

  if (!parsed.success) {
    throw new Error("Stored match score state is invalid");
  }

  return {
    ...parsed.data,
    matchFinished: parsed.data.matchFinished ?? false,
  };
}

async function nextEventSequence(
  tx: Prisma.TransactionClient,
  matchId: string,
): Promise<number> {
  const lastEvent = await tx.scoringEvent.findFirst({
    where: { matchId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return (lastEvent?.sequence ?? 0) + 1;
}

// GET /api/matches — list all matches.
router.get("/", async (_req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { createdAt: "desc" },
      include: { playerOne: true, playerTwo: true },
    });

    res.json({ data: matches });
  } catch (error) {
    console.error("List matches failed:", error);
    res.status(500).json({ error: "Unable to retrieve matches" });
  }
});

// POST /api/matches — create a scheduled match.
router.post("/", async (req, res) => {
  const result = createMatchSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid match data",
      details: result.error.issues,
    });
    return;
  }

  const { tournamentId, playerOneId, playerTwoId, bestOf } = result.data;

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const participants = await prisma.tournamentParticipant.findMany({
      where: {
        tournamentId,
        playerId: { in: [playerOneId, playerTwoId] },
      },
      select: { playerId: true },
    });

    const registeredIds = new Set(
      participants.map((participant) => participant.playerId),
    );

    if (
      !registeredIds.has(playerOneId) ||
      !registeredIds.has(playerTwoId)
    ) {
      res.status(400).json({
        error: "Both players must be registered in the tournament",
      });
      return;
    }

    const match = await prisma.match.create({
      data: {
        tournamentId,
        playerOneId,
        playerTwoId,
        bestOf,
        status: "SCHEDULED",
        scoreState: initialScoreState(),
      },
      include: { playerOne: true, playerTwo: true },
    });

    res.status(201).json({ data: match });
  } catch (error) {
    console.error("Create match failed:", error);
    res.status(500).json({ error: "Unable to create match" });
  }
});

// GET /api/matches/:id — get a match and its score.
router.get("/:id", async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { playerOne: true, playerTwo: true },
    });

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    res.setHeader("ETag", `"${match.version}"`);
    res.json({ data: match });
  } catch (error) {
    console.error("Get match failed:", error);
    res.status(500).json({ error: "Unable to retrieve match" });
  }
});

// POST /api/matches/:id/start — start a scheduled match.
router.post("/:id/start", async (req, res) => {
  const parsed = versionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "expectedVersion is required",
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const outcome = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const match = await tx.match.findUnique({
          where: { id: req.params.id },
        });

        if (!match) return { kind: "not-found" as const };

        if (match.status !== "SCHEDULED") {
          return { kind: "invalid-status" as const };
        }

        if (match.version !== parsed.data.expectedVersion) {
          return { kind: "conflict" as const };
        }

        const changed = await tx.match.updateMany({
          where: {
            id: match.id,
            version: parsed.data.expectedVersion,
            status: "SCHEDULED",
          },
          data: {
            status: "LIVE",
            version: { increment: 1 },
          },
        });

        if (changed.count !== 1) {
          return { kind: "conflict" as const };
        }

        const scoreState = readScoreState(match.scoreState);
        const sequence = await nextEventSequence(tx, match.id);

        await tx.scoringEvent.create({
          data: {
            matchId: match.id,
            sequence,
            type: "MATCH_STARTED",
            beforeState: scoreState,
            afterState: scoreState,
          },
        });

        const updated = await tx.match.findUnique({
          where: { id: match.id },
          include: { playerOne: true, playerTwo: true },
        });

        return { kind: "ok" as const, match: updated };
      },
    );

    if (outcome.kind === "not-found") {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    if (outcome.kind === "invalid-status") {
      res.status(409).json({
        error: "Only scheduled matches can be started",
      });
      return;
    }

    if (outcome.kind === "conflict") {
      res.status(409).json({
        error: "Match changed. Refresh the score and try again.",
      });
      return;
    }

    res.setHeader("ETag", `"${outcome.match?.version ?? 0}"`);
    res.json({ data: outcome.match });
  } catch (error) {
    console.error("Start match failed:", error);
    res.status(500).json({ error: "Unable to start match" });
  }
});

// POST /api/matches/:id/points — award a point.
// winnerSide: 0 = Player One, 1 = Player Two.
router.post("/:id/points", async (req, res) => {
  const parsed = pointSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide winnerSide (0 or 1) and expectedVersion",
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const outcome = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const match = await tx.match.findUnique({
          where: { id: req.params.id },
        });

        if (!match) return { kind: "not-found" as const };

        if (match.status !== "LIVE") {
          return { kind: "invalid-status" as const };
        }

        if (match.version !== parsed.data.expectedVersion) {
          return { kind: "conflict" as const };
        }

        const beforeState = readScoreState(match.scoreState);

        let result;

        try {
          result = awardPoint(
            beforeState,
            parsed.data.winnerSide,
            match.bestOf as 1 | 3 | 5,
          );
        } catch (error) {
          if (error instanceof Error) {
            return {
              kind: "scoring-error" as const,
              message: error.message,
            };
          }
          throw error;
        }

        const winnerId =
          result.winnerSide === null
            ? null
            : result.winnerSide === 0
              ? match.playerOneId
              : match.playerTwoId;

        const changed = await tx.match.updateMany({
          where: {
            id: match.id,
            version: parsed.data.expectedVersion,
            status: "LIVE",
          },
          data: {
            scoreState: result.state,
            status: result.matchFinished ? "COMPLETED" : "LIVE",
            winnerId: result.matchFinished ? winnerId : null,
            version: { increment: 1 },
          },
        });

        if (changed.count !== 1) {
          return { kind: "conflict" as const };
        }

        let sequence = await nextEventSequence(tx, match.id);

        await tx.scoringEvent.create({
          data: {
            matchId: match.id,
            sequence,
            type: "POINT_AWARDED",
            pointWinnerId:
              parsed.data.winnerSide === 0
                ? match.playerOneId
                : match.playerTwoId,
            beforeState,
            afterState: result.state,
          },
        });

        if (result.matchFinished) {
          sequence += 1;

          await tx.scoringEvent.create({
            data: {
              matchId: match.id,
              sequence,
              type: "MATCH_ENDED",
              pointWinnerId: winnerId,
              beforeState: result.state,
              afterState: result.state,
            },
          });
        }

        const updated = await tx.match.findUnique({
          where: { id: match.id },
          include: { playerOne: true, playerTwo: true },
        });

        return {
          kind: "ok" as const,
          match: updated,
          gameFinished: result.gameFinished,
          matchFinished: result.matchFinished,
          winnerId,
        };
      },
    );

    if (outcome.kind === "not-found") {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    if (outcome.kind === "invalid-status") {
      res.status(409).json({
        error: "Match must be live to award points",
      });
      return;
    }

    if (outcome.kind === "conflict") {
      res.status(409).json({
        error: "Match changed. Refresh the score and try again.",
      });
      return;
    }

    if (outcome.kind === "scoring-error") {
      res.status(409).json({ error: outcome.message });
      return;
    }

    res.setHeader("ETag", `"${outcome.match?.version ?? 0}"`);
    res.json({
      data: outcome.match,
      gameFinished: outcome.gameFinished,
      matchFinished: outcome.matchFinished,
      winnerId: outcome.winnerId,
    });
  } catch (error) {
    console.error("Award point failed:", error);

    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack:", error.stack);
    }

    res.status(500).json({ error: "Unable to award point" });
  }
});

// GET /api/matches/:id/events — read scoring audit history.
router.get("/:id/events", async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    const events = await prisma.scoringEvent.findMany({
      where: { matchId: match.id },
      orderBy: { sequence: "asc" },
    });

    res.json({ data: events });
  } catch (error) {
    console.error("Get scoring events failed:", error);
    res.status(500).json({
      error: "Unable to retrieve scoring history",
    });
  }
});


/* POST /api/matches/:id/pause — pause a live match. */
router.post("/:id/pause", async (req, res) => {
  const parsed = versionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "expectedVersion is required",
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const outcome = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const match = await tx.match.findUnique({
          where: { id: req.params.id },
        });

        if (!match) return { kind: "not-found" as const };

        if (match.status !== "LIVE") {
          return { kind: "invalid-status" as const };
        }

        if (match.version !== parsed.data.expectedVersion) {
          return { kind: "conflict" as const };
        }

        const changed = await tx.match.updateMany({
          where: {
            id: match.id,
            version: parsed.data.expectedVersion,
            status: "LIVE",
          },
          data: {
            status: "PAUSED",
            version: { increment: 1 },
          },
        });

        if (changed.count !== 1) {
          return { kind: "conflict" as const };
        }

        const scoreState = readScoreState(match.scoreState);
        const sequence = await nextEventSequence(tx, match.id);

        await tx.scoringEvent.create({
          data: {
            matchId: match.id,
            sequence,
            type: "MATCH_PAUSED",
            beforeState: scoreState,
            afterState: scoreState,
          },
        });

        const updated = await tx.match.findUnique({
          where: { id: match.id },
          include: { playerOne: true, playerTwo: true },
        });

        return { kind: "ok" as const, match: updated };
      },
    );

    if (outcome.kind === "not-found") {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    if (outcome.kind === "invalid-status") {
      res.status(409).json({ error: "Only live matches can be paused" });
      return;
    }

    if (outcome.kind === "conflict") {
      res.status(409).json({
        error: "Match changed. Refresh the score and try again.",
      });
      return;
    }

    res.setHeader("ETag", `"${outcome.match?.version ?? 0}"`);
    res.json({ data: outcome.match });
  } catch (error) {
    console.error("Pause match failed:", error);
    res.status(500).json({ error: "Unable to pause match" });
  }
});

/* POST /api/matches/:id/resume — resume a paused match. */
router.post("/:id/resume", async (req, res) => {
  const parsed = versionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "expectedVersion is required",
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const outcome = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const match = await tx.match.findUnique({
          where: { id: req.params.id },
        });

        if (!match) return { kind: "not-found" as const };

        if (match.status !== "PAUSED") {
          return { kind: "invalid-status" as const };
        }

        if (match.version !== parsed.data.expectedVersion) {
          return { kind: "conflict" as const };
        }

        const changed = await tx.match.updateMany({
          where: {
            id: match.id,
            version: parsed.data.expectedVersion,
            status: "PAUSED",
          },
          data: {
            status: "LIVE",
            version: { increment: 1 },
          },
        });

        if (changed.count !== 1) {
          return { kind: "conflict" as const };
        }

        const scoreState = readScoreState(match.scoreState);
        const sequence = await nextEventSequence(tx, match.id);

        await tx.scoringEvent.create({
          data: {
            matchId: match.id,
            sequence,
            type: "MATCH_RESUMED",
            beforeState: scoreState,
            afterState: scoreState,
          },
        });

        const updated = await tx.match.findUnique({
          where: { id: match.id },
          include: { playerOne: true, playerTwo: true },
        });

        return { kind: "ok" as const, match: updated };
      },
    );

    if (outcome.kind === "not-found") {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    if (outcome.kind === "invalid-status") {
      res.status(409).json({
        error: "Only paused matches can be resumed",
      });
      return;
    }

    if (outcome.kind === "conflict") {
      res.status(409).json({
        error: "Match changed. Refresh the score and try again.",
      });
      return;
    }

    res.setHeader("ETag", `"${outcome.match?.version ?? 0}"`);
    res.json({ data: outcome.match });
  } catch (error) {
    console.error("Resume match failed:", error);
    res.status(500).json({ error: "Unable to resume match" });
  }
});

export default router;
