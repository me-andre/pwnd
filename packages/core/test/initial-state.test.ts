import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/initial-state.js";

describe("createInitialState", () => {
  it("has 8 white dudes on rank 1 and 8 black dudes on rank 8", () => {
    const state = createInitialState();
    for (let file = 0; file < 8; file++) {
      const whiteDude = state.board[file];
      expect(whiteDude?.kind).toBe("dude");
      expect(whiteDude?.owner).toBe("white");

      const blackDude = state.board[56 + file];
      expect(blackDude?.kind).toBe("dude");
      expect(blackDude?.owner).toBe("black");
    }
  });

  it("has 8 white pawns on rank 2 and 8 black pawns on rank 7", () => {
    const state = createInitialState();
    for (let file = 0; file < 8; file++) {
      const wp = state.board[8 + file];
      expect(wp?.kind).toBe("materialized");
      if (wp?.kind === "materialized") expect(wp.piece).toBe("P");

      const bp = state.board[48 + file];
      expect(bp?.kind).toBe("materialized");
      if (bp?.kind === "materialized") expect(bp.piece).toBe("P");
    }
  });

  it("starts on white's turn (turnNumber 0)", () => {
    const state = createInitialState();
    expect(state.turnNumber).toBe(0);
  });

  it("has full castling rights", () => {
    const state = createInitialState();
    expect(state.castlingRights.whiteKingSide).toBe(true);
    expect(state.castlingRights.whiteQueenSide).toBe(true);
    expect(state.castlingRights.blackKingSide).toBe(true);
    expect(state.castlingRights.blackQueenSide).toBe(true);
  });

  it("has empty squares between ranks 3–6", () => {
    const state = createInitialState();
    for (let idx = 16; idx < 48; idx++) {
      expect(state.board[idx]).toBeNull();
    }
  });

  it("has ongoing result", () => {
    const state = createInitialState();
    expect(state.result.status).toBe("ongoing");
  });
});
