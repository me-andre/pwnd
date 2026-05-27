import { describe, expect, it } from "vitest";
import { applyMove, isCheckmate, isInCheck } from "../src/apply-move.js";
import { algebraicToIndex } from "../src/squares.js";
import { buildState } from "./state-builder.js";

const sq = algebraicToIndex;

describe("isCheckmate", () => {
  it("detects Scholar's mate (queen on f7, bishop on c4)", () => {
    // Scholar's mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    // Bishop c4 protects f7 (d5, e6 both empty so the c4-f7 diagonal is clear).
    // e-pawn is on e5 (moved from e7), leaving the c4→f7 diagonal open.
    // Black queen d8 blocks d8. Black knight f6 (moved) and c6 cannot capture f7.
    const state = buildState(`
      8 r n b q k b . r
      7 p p p p . Q p p
      6 . . n . . n . .
      5 . . . . p . . .
      4 . . B . P . . .
      3 . . . . . . . .
      2 P P P P . P P P
      1 R N B Q K B N R
      turn: black
      castling: -
    `);
    expect(isInCheck(state, "black")).toBe(true);
    expect(isCheckmate(state, "black")).toBe(true);
  });

  it("check that can be resolved is not checkmate", () => {
    // White rook on h8 checks black king e8, but king can move to d7 or f7.
    const state = buildState(`
      8 . . . . k . . R
      7 . . . . . . . .
      6 . . . . . . . K
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . .
      turn: black
      castling: -
    `);
    expect(isInCheck(state, "black")).toBe(true);
    expect(isCheckmate(state, "black")).toBe(false);
  });

  it("back-rank mate: two rooks, first protected by king", () => {
    // White rook g7 (protected by king g6) attacks g8 and h7.
    // White rook h1 attacks h8 (path clear: h2-h7 empty).
    // Black king h8: g8 (attacked by rook g7), h7 (attacked by rook g7),
    // g7 (occupied+protected by king g6). No escape.
    const state = buildState(`
      8 . . . . . . . k
      7 . . . . . . R .
      6 . . . . . . K .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . R
      turn: black
      castling: -
    `);
    expect(isInCheck(state, "black")).toBe(true);
    expect(isCheckmate(state, "black")).toBe(true);
  });

  it("queen + king corner mate", () => {
    // Queen on a8 attacks entire rank 8 (b8..h8 clear). White king g6 covers g7+h7.
    // Black king h8: g8 (queen attacks), h7 (king attacks), g7 (king attacks).
    const state = buildState(`
      8 Q . . . . . . k
      7 . . . . . . . .
      6 . . . . . . K .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . .
      turn: black
      castling: -
    `);
    expect(isInCheck(state, "black")).toBe(true);
    expect(isCheckmate(state, "black")).toBe(true);
  });
});

describe("applyMove — result propagation", () => {
  it("game result becomes win after checkmate move", () => {
    // White queen on a7 moves to a8: ranks 8 path b8-g8 all clear. King g6 covers g7+h7.
    const beforeMate = buildState(`
      8 . . . . . . . k
      7 Q . . . . . . .
      6 . . . . . . K .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . .
      turn: white
      castling: -
    `);
    const result = applyMove(beforeMate, { kind: "normal", from: sq("a7"), to: sq("a8") });
    expect(result.accepted).toBe(true);
    expect(result.nextState.result.status).toBe("win");
    if (result.nextState.result.status === "win") {
      expect(result.nextState.result.winner).toBe("white");
    }
  });
});
