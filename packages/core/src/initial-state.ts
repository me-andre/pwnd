import { propagate } from "./candidates.js";
import type { Cell, CastlingRights, GameState } from "./types.js";
import { ALL_DUDE_KINDS } from "./types.js";

/** Return the initial GameState for a new game. */
export function createInitialState(): GameState {
  const board: Cell[] = Array(64).fill(null);

  // Place pawns: white on rank 2 (indices 8–15), black on rank 7 (indices 48–55).
  for (let file = 0; file < 8; file++) {
    board[8 + file] = { kind: "materialized", owner: "white", piece: "P" };
    board[48 + file] = { kind: "materialized", owner: "black", piece: "P" };
  }

  // Place dudes: white on rank 1 (indices 0–7), black on rank 8 (indices 56–63).
  for (let file = 0; file < 8; file++) {
    board[file] = {
      kind: "dude",
      owner: "white",
      localCandidates: [...ALL_DUDE_KINDS],
    };
    board[56 + file] = {
      kind: "dude",
      owner: "black",
      localCandidates: [...ALL_DUDE_KINDS],
    };
  }

  const castlingRights: CastlingRights = {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  };

  // Run initial propagation (resolves king-eager if all 8 dudes remain).
  // With 8 full-superposition dudes per side there is no singleton yet, so
  // this is a no-op but included for correctness.
  const { board: propagatedBoard } = propagate(board);

  return {
    board: propagatedBoard,
    turnNumber: 0,
    moveLog: [],
    castlingRights,
    result: { status: "ongoing" },
    enPassantTarget: null,
  };
}
