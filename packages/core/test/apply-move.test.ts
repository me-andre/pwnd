import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves, isInCheck, whoseTurn } from "../src/apply-move.js";
import { algebraicToIndex } from "../src/squares.js";
import { buildState } from "./state-builder.js";

const sq = algebraicToIndex;

describe("applyMove — basic dude moves", () => {
  it("dude moves a1→b3 and materializes as knight (only knight geometry)", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D . . . K . . .
      turn: white
      castling: -
    `);

    const result = applyMove(state, { kind: "normal", from: sq("a1"), to: sq("b3") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("b3")];
    expect(cell?.kind).toBe("materialized");
    if (cell?.kind === "materialized") {
      expect(cell.piece).toBe("N");
    }
  });

  it("dude moves a1→b2 and narrows to bishop/queen/king", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D D D D K . . .
      turn: white
      castling: -
    `);

    const result = applyMove(state, { kind: "normal", from: sq("a1"), to: sq("b2") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("b2")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(cell.localCandidates).toContain("B");
      expect(cell.localCandidates).toContain("Q");
      expect(cell.localCandidates).not.toContain("R");
      expect(cell.localCandidates).not.toContain("N");
    }
  });

  it("rejects move for wrong side", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D . . . K . . .
      turn: white
      castling: -
    `);
    // Trying to move black dude
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("e7") });
    expect(result.accepted).toBe(false);
  });

  it("rejects move to incompatible square", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D[BQ] . . . K . . .
      turn: white
      castling: -
    `);
    // BQ dude can't move like a knight
    const result = applyMove(state, { kind: "normal", from: sq("a1"), to: sq("b3") });
    expect(result.accepted).toBe(false);
  });
});

describe("applyMove — pawn moves", () => {
  it("white pawn can move one square forward", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 P . . . . . . .
      1 . . . . K . . .
      turn: white
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("a2"), to: sq("a3") });
    expect(result.accepted).toBe(true);
    expect(result.nextState.board[sq("a3")]?.kind).toBe("materialized");
  });

  it("white pawn double-push from rank 2", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 P . . . . . . .
      1 . . . . K . . .
      turn: white
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("a2"), to: sq("a4") });
    expect(result.accepted).toBe(true);
    expect(result.nextState.enPassantTarget).toBe(sq("a3"));
  });

  it("pawn promotes to dude on reaching back rank", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 P . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . K . . .
      turn: white
      castling: -
    `);
    const result = applyMove(state, { kind: "promotion", from: sq("a7"), to: sq("a8") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("a8")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(cell.owner).toBe("white");
    }
  });
});

describe("applyMove — check and king safety", () => {
  it("cannot make a move that leaves king in check", () => {
    // White king on e1, white rook on e4 pinned by black rook on e8
    const state = buildState(`
      8 . . . . r . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . R . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . K . k .
      turn: white
      castling: -
    `);
    // Moving the pinned rook away from the e-file exposes the king
    const result = applyMove(state, { kind: "normal", from: sq("e4"), to: sq("f4") });
    expect(result.accepted).toBe(false);
  });

  it("isInCheck detects check on materialized king", () => {
    // Black rook on e8 attacks the white king on e1 down the open e-file.
    const state = buildState(`
      8 . . . . r . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . K . . .
      turn: black
      castling: -
    `);
    expect(isInCheck(state, "white")).toBe(true);
  });
});

describe("applyMove — castling", () => {
  it("dude castles king-side, both materialize (dude as king, partner as rook)", () => {
    const state = buildState(`
      8 k . . . . . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . D . . D
      turn: white
      castling: Kk
    `);
    // White dude on e1 (index 4) castles king-side with dude on h1 (index 7)
    const result = applyMove(state, {
      kind: "castling",
      from: sq("e1"),
      to: sq("g1"),
      rookFrom: sq("h1"),
      rookTo: sq("f1"),
    });
    expect(result.accepted).toBe(true);
    const king = result.nextState.board[sq("g1")];
    const rook = result.nextState.board[sq("f1")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") expect(king.piece).toBe("K");
    expect(rook?.kind).toBe("materialized");
    if (rook?.kind === "materialized") expect(rook.piece).toBe("R");
  });
});

describe("applyMove — en-passant", () => {
  it("white pawn captures en-passant", () => {
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
    const result = applyMove(state, {
      kind: "en-passant",
      from: sq("d5"),
      to: sq("e6"),
      capturedPawnSquare: sq("e5"),
    });
    expect(result.accepted).toBe(true);
    expect(result.nextState.board[sq("e5")]).toBeNull();
    expect(result.nextState.board[sq("e6")]?.kind).toBe("materialized");
  });
});

describe("whoseTurn", () => {
  it("returns white on even turn numbers", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . K . . .
      turn: white
      castling: -
    `);
    expect(whoseTurn(state)).toBe("white");
  });
});

describe("getLegalMoves", () => {
  it("empty square returns no moves", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . K . . .
      turn: white
      castling: -
    `);
    expect(getLegalMoves(state, sq("a1"))).toHaveLength(0);
  });
});
