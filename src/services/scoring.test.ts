
import { describe, it, expect } from "vitest";
import { initialScoreState, awardPoint } from "./scoring.js";

describe("Badminton scoring engine", () => {
  it("awards a point to the selected player", () => {
    const result = awardPoint(initialScoreState(), 0);

    expect(result.state.points).toEqual([1, 0]);
    expect(result.state.servingSide).toBe(0);
  });

  it("requires a two-point lead after 20-20", () => {
    let state = initialScoreState();

    for (let i = 0; i < 20; i++) {
      state = awardPoint(state, 0).state;
      state = awardPoint(state, 1).state;
    }

    const result = awardPoint(state, 0);

    expect(result.gameFinished).toBe(false);
    expect(result.state.points).toEqual([21, 20]);
  });

  it("ends the game at 30-29", () => {
    let state = initialScoreState();

    for (let i = 0; i < 29; i++) {
      state = awardPoint(state, 0).state;
      state = awardPoint(state, 1).state;
    }

    const result = awardPoint(state, 0);

    expect(result.gameFinished).toBe(true);
    expect(result.state.games[0]).toEqual({
      playerOne: 30,
      playerTwo: 29,
    });
  });

  it("ends a game at 21-19", () => {
    let state = initialScoreState();

    for (let i = 0; i < 19; i++) {
      state = awardPoint(state, 0).state;
      state = awardPoint(state, 1).state;
    }

    state = awardPoint(state, 0).state;
    const result = awardPoint(state, 0);

    expect(result.gameFinished).toBe(true);
    expect(result.state.games[0]).toEqual({
      playerOne: 21,
      playerTwo: 19,
    });
  });

  it("continues at 21-20 until a two-point lead", () => {
    let state = initialScoreState();

    for (let i = 0; i < 20; i++) {
      state = awardPoint(state, 0).state;
      state = awardPoint(state, 1).state;
    }

    state = awardPoint(state, 0).state;
    const result = awardPoint(state, 0);

    expect(result.gameFinished).toBe(true);
    expect(result.state.games[0]).toEqual({
      playerOne: 22,
      playerTwo: 20,
    });
  });

  it("finishes a best-of-three match after two games won", () => {
    let state = initialScoreState();

    for (let game = 0; game < 2; game++) {
      for (let point = 0; point < 21; point++) {
        state = awardPoint(state, 0, 3).state;
      }
    }

    expect(state.gamesWon).toEqual([2, 0]);
    expect(state.games).toHaveLength(2);
  });

  it("does not mutate the original score state", () => {
    const original = initialScoreState();

    awardPoint(original, 0);

    expect(original.points).toEqual([0, 0]);
    expect(original.games).toEqual([]);
    expect(original.gamesWon).toEqual([0, 0]);
  });
});
