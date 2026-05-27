import { describe, expect, it } from "vitest";
import { algebraicToIndex } from "../src/squares.js";
import { buildState } from "./state-builder.js";

const sq = algebraicToIndex;

describe("state-builder", () => {
  it("parses a full initial position correctly", () => {
    const state = buildState(`
      8 d d d d d d d d
      7 p p p p p p p p
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 P P P P P P P P
      1 D D D D D D D D
      turn: white
      castling: KQkq
    `);

    expect(state.turnNumber).toBe(0);
    expect(state.castlingRights.whiteKingSide).toBe(true);

    // White pawn on a2
    const wp = state.board[sq("a2")];
    expect(wp?.kind).toBe("materialized");
    if (wp?.kind === "materialized") {
      expect(wp.piece).toBe("P");
      expect(wp.owner).toBe("white");
    }

    // Black pawn on a7
    const bp = state.board[sq("a7")];
    expect(bp?.kind).toBe("materialized");
    if (bp?.kind === "materialized") {
      expect(bp.piece).toBe("P");
      expect(bp.owner).toBe("black");
    }
  });

  it("parses narrowed dudes", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D[BQK] . . . K . . .
      turn: white
      castling: -
    `);
    const cell = state.board[sq("a1")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(cell.localCandidates).toContain("B");
      expect(cell.localCandidates).toContain("Q");
      expect(cell.localCandidates).not.toContain("R");
      expect(cell.localCandidates).not.toContain("N");
    }
  });

  it("parses materialized pieces", () => {
    const state = buildState(`
      8 r n b q k b n r
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 R N B Q K B N R
      turn: white
      castling: KQkq
    `);
    const whiteKing = state.board[sq("e1")];
    expect(whiteKing?.kind).toBe("materialized");
    if (whiteKing?.kind === "materialized") {
      expect(whiteKing.piece).toBe("K");
      expect(whiteKing.owner).toBe("white");
    }

    const blackQueen = state.board[sq("d8")];
    expect(blackQueen?.kind).toBe("materialized");
    if (blackQueen?.kind === "materialized") {
      expect(blackQueen.piece).toBe("Q");
      expect(blackQueen.owner).toBe("black");
    }
  });

  it("parses en-passant target", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . P p . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . K . . .
      turn: white
      castling: -
      enPassant: e6
    `);
    expect(state.enPassantTarget).toBe(sq("e6"));
  });
});
