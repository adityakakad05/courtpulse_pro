
export type ScoreState = {
  games: Array<{ playerOne: number; playerTwo: number }>;
  currentGame: number;
  points: [number, number];
  gamesWon: [number, number];
  servingSide: 0 | 1;
  matchFinished: boolean;
};

export type PointResult = {
  state: ScoreState;
  gameFinished: boolean;
  matchFinished: boolean;
  winnerSide: 0 | 1 | null;
};

export function initialScoreState(): ScoreState {
  return {
    games: [],
    currentGame: 1,
    points: [0, 0],
    gamesWon: [0, 0],
    servingSide: 0,
    matchFinished: false,
  };
}

export function awardPoint(
  current: ScoreState,
  winnerSide: 0 | 1,
  bestOf: 1 | 3 | 5 = 3,
): PointResult {
  if (current.matchFinished) {
    throw new Error("Cannot award points after the match has ended");
  }

  const state: ScoreState = {
    ...current,
    games: current.games.map((game) => ({ ...game })),
    points: [...current.points] as [number, number],
    gamesWon: [...current.gamesWon] as [number, number],
  };

  state.points[winnerSide] += 1;
  state.servingSide = winnerSide;

  const [a, b] = state.points;
  const high = Math.max(a, b);
  const low = Math.min(a, b);

  const gameFinished =
    (high >= 21 && high - low >= 2) || high === 30;

  if (!gameFinished) {
    return {
      state,
      gameFinished: false,
      matchFinished: false,
      winnerSide: null,
    };
  }

  const gameWinner: 0 | 1 = a > b ? 0 : 1;

  state.games.push({ playerOne: a, playerTwo: b });
  state.gamesWon[gameWinner] += 1;

  const gamesNeeded = Math.floor(bestOf / 2) + 1;
  const matchFinished = state.gamesWon[gameWinner] >= gamesNeeded;

  state.matchFinished = matchFinished;

  if (!matchFinished) {
    state.currentGame += 1;
    state.points = [0, 0];
  }

  return {
    state,
    gameFinished: true,
    matchFinished,
    winnerSide: gameWinner,
  };
}
