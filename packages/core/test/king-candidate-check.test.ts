/**
 * Tests for the §2.8 king-candidate check mechanic:
 *
 * When an opponent attacks a dude whose effective candidate set contains king,
 * the dude becomes a "king-candidate under check". The owner must respond:
 *
 *   Option A — The attacked dude itself makes a move incompatible with king
 *              (eliminates K from its local candidates). The dude is now proven
 *              NOT to be the king; the attack is resolved.
 *
 *   Option B — Anything else: block, capture the attacker, or the attacked
 *              dude moves king-compatibly. As a side-effect the attacked dude
 *              materializes as king.
 *
 * A move whose Option-B materialization leaves the (now real) king in check is
 * illegal, just like any move that leaves your king in check.
 *
 * IMPORTANT FIXTURE NOTE: a side with no materialized king and exactly one
 * dude still carrying K eagerly materializes that dude as king (king-eager
 * propagation). To keep a dude as a *king-candidate*, every fixture below gives
 * the side at least TWO king-candidate dudes, so neither collapses on parse.
 */

import { describe, expect, it } from "vitest";
import {
  applyMove,
  findKingCandidateUnderAttack,
  getLegalMoves,
  isCheckmate,
} from "../src/apply-move.js";
import { algebraicToIndex } from "../src/squares.js";
import { buildState } from "./state-builder.js";

const sq = algebraicToIndex;

// ── Detection ─────────────────────────────────────────────────────────────────

describe("findKingCandidateUnderAttack", () => {
  it("returns null when the attacked dude has no K in its candidates", () => {
    // Black dude on e8 has only {R,N,B}. White rook on e1 attacks it, but it is
    // not a king-candidate. Black has a real king on a8.
    const state = buildState(`
      8 k . . . d[rnb] . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    expect(findKingCandidateUnderAttack(state, "black")).toBeNull();
  });

  it("returns the square of an attacked dude that still carries K", () => {
    // Two black king-candidates (a8 spare, e8 subject). White rook on e1
    // attacks e8 down the open e-file.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    expect(findKingCandidateUnderAttack(state, "black")).toBe(sq("e8"));
  });

  it("only inspects the requested side", () => {
    // Black's e8 king-candidate is under attack, but querying white (who has a
    // materialized king and no dudes) returns null.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    expect(findKingCandidateUnderAttack(state, "white")).toBeNull();
  });
});

// ── Option A: attacked dude proves it is not the king ─────────────────────────

describe("§2.8 Option A — attacked dude proves non-king and resolves the attack", () => {
  it("knight jump sheds K — dude materializes as a knight, not a king", () => {
    // White rook on e1 attacks black dude on e8 (king-candidate check).
    // e8 jumps to f6 (knight geometry → {N}); it is now provably not the king.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("f6") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("f6")];
    expect(cell?.kind).toBe("materialized");
    if (cell?.kind === "materialized") {
      expect(cell.piece).toBe("N");
      expect(cell.piece).not.toBe("K");
    }
  });

  it("long horizontal slide sheds K — dude stays a {R,Q} dude (not a king)", () => {
    // White rook on e1 attacks black dude on e8.
    // e8 slides to b8 (multi-square horizontal → {R,Q}); K and N are shed.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("b8") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("b8")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(cell.localCandidates).not.toContain("K");
      expect(cell.localCandidates).toEqual(expect.arrayContaining(["R", "Q"]));
    }
  });
});

// ── Option B: block → attacked dude materializes as king ──────────────────────

describe("§2.8 Option B — blocking the attack materializes the attacked dude as king", () => {
  it("another dude blocks the rook's line → attacked dude becomes king", () => {
    // White rook on e1 attacks black dude on e8.
    // Black dude on d7 blocks by moving to e7.
    const state = buildState(`
      8 . . . . d . . .
      7 . . . d . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("d7"), to: sq("e7") });
    expect(result.accepted).toBe(true);
    const king = result.nextState.board[sq("e8")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
      expect(king.owner).toBe("black");
    }
  });

  it("the forced king square is reported in materializedSquares", () => {
    const state = buildState(`
      8 . . . . d . . .
      7 . . . d . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("d7"), to: sq("e7") });
    expect(result.replayedMove.materializedSquares).toContain(sq("e8"));
  });
});

// ── Option B: capture attacker → attacked dude materializes as king ───────────

describe("§2.8 Option B — capturing the attacker materializes the attacked dude as king", () => {
  it("a rook captures the attacker → attacked dude becomes king", () => {
    // White rook on e1 attacks black dude on e8.
    // Black rook on h1 captures the white rook (path f1,g1 clear).
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 K . . . R . . r
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("h1"), to: sq("e1") });
    expect(result.accepted).toBe(true);
    const king = result.nextState.board[sq("e8")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
    }
  });

  it("a pawn captures the attacker → attacked dude becomes king", () => {
    // White rook on d5 attacks black dude on d8 (d6,d7 clear).
    // Black pawn on e6 captures the rook on d5.
    const state = buildState(`
      8 d . . d . . . .
      7 . . . . . . . .
      6 . . . . p . . .
      5 . . . R . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e6"), to: sq("d5") });
    expect(result.accepted).toBe(true);
    const king = result.nextState.board[sq("d8")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
    }
  });
});

// ── Option B: king-compatible move → dude materializes as king ────────────────

describe("§2.8 Option B — king-compatible move by the attacked dude materializes it as king", () => {
  it("attacked dude steps one square diagonally off the attack line → king", () => {
    // White rook on e1 attacks black dude on e8.
    // e8 steps to d7 (one-square diagonal → {B,Q,K}); off the e-file, safe.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("d7") });
    expect(result.accepted).toBe(true);
    const king = result.nextState.board[sq("d7")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
    }
  });

  it("attacked dude steps one square forward off the attack line → king", () => {
    // White bishop on h5 attacks black dude on e8 (g6,f7 clear).
    // e8 steps to e7 (one square forward → {R,Q,K}); off the bishop diagonal.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . B
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("e7") });
    expect(result.accepted).toBe(true);
    const king = result.nextState.board[sq("e7")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
    }
  });
});

// ── Legality: bad / non-resolving responses are illegal ───────────────────────

describe("§2.8 legality — moves that leave the materialized king in check are rejected", () => {
  it("an unrelated move is rejected because the forced king would be in check", () => {
    // White rook on e1 attacks black dude on e8. Black pushes an unrelated pawn
    // a7→a6: e8 is forced to materialize as king and is still in check.
    const state = buildState(`
      8 d . . . d . . .
      7 p . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("a7"), to: sq("a6") });
    expect(result.accepted).toBe(false);
  });

  it("a block that only stops one of two attackers is rejected", () => {
    // White rook on e1 (e-file) AND white bishop on h5 (h5-e8 diagonal) both
    // attack e8. Black dude d7 blocks the e-file via e7, but the bishop still
    // hits e8 → forced king in check → rejected.
    const state = buildState(`
      8 . . . . d . . .
      7 . . . d . . . .
      6 . . . . . . . .
      5 . . . . . . . B
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("d7"), to: sq("e7") });
    expect(result.accepted).toBe(false);
  });

  it("an Option-A escape that sheds K is legal even though the e-file stays open", () => {
    // White rook on e1 attacks e8. e8 jumps to f6 (knight) shedding K — proven
    // not the king. Legal; the spare a8 dude becomes the king instead.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("f6") });
    expect(result.accepted).toBe(true);
    expect(result.nextState.board[sq("e8")]).toBeNull();
  });
});

// ── Checkmate via king-candidate check ────────────────────────────────────────

describe("§2.8 checkmate — no legal response to king-candidate check", () => {
  it("double king-candidate, both attacked, with no resolving move is checkmate", () => {
    // Two black king-candidates: a8 (attacked by rook a1) and h8 (attacked by
    // rook h1). Rooks b1/g1 cover the b- and g-files so neither dude can step to
    // a safe king square. White pawns e4/e5 block the two long diagonals so
    // neither dude can capture the other's attacker. Any shed-K move forces the
    // *other* dude to become a king that is still in check. → checkmate.
    const state = buildState(`
      8 d . . . . . . d
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . P . . .
      4 . . . . P . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 R R . K . . R R
      turn: black
      castling: -
    `);
    expect(findKingCandidateUnderAttack(state, "black")).toBe(sq("a8"));
    expect(isCheckmate(state, "black")).toBe(true);
  });

  it("a king-candidate check with an Option-A escape is NOT checkmate", () => {
    // White rook on e1 attacks e8, but e8 can jump to f6 (knight) to escape.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    expect(isCheckmate(state, "black")).toBe(false);
  });
});

// ── getLegalMoves surface ─────────────────────────────────────────────────────

describe("§2.8 getLegalMoves filtering", () => {
  it("attacked dude: only moves that resolve the attack are legal", () => {
    // White rook on e1 attacks e8.
    //  - f6 (knight): sheds K → legal.
    //  - d7 (one-square diagonal): forced king on d7 (off e-file) → legal.
    //  - e7 (one-square forward): forced king on e7 still on the e-file → illegal.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const toSquares = getLegalMoves(state, sq("e8")).map((m) => m.to);
    expect(toSquares).toContain(sq("f6"));
    expect(toSquares).toContain(sq("d7"));
    expect(toSquares).not.toContain(sq("e7"));
  });

  it("a blocker's legal moves include only those that actually cover the attack", () => {
    // White rook on e1 attacks e8. Black dude d7:
    //  - e7 blocks the e-file → legal.
    //  - c6 does not block → forced king on e8 still in check → illegal.
    const state = buildState(`
      8 . . . . d . . .
      7 . . . d . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const toSquares = getLegalMoves(state, sq("d7")).map((m) => m.to);
    expect(toSquares).toContain(sq("e7"));
    expect(toSquares).not.toContain(sq("c6"));
  });
});

// ── En-passant path ───────────────────────────────────────────────────────────

describe("§2.8 en-passant — forced materialization also applies", () => {
  it("an en-passant capture that does not resolve the check is rejected", () => {
    // White rook on e1 attacks e8. Black pawn d4 can capture en-passant on c3,
    // but that does not resolve the e-file attack → forced king in check.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . P p . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
      enPassant: c3
    `);
    const result = applyMove(state, {
      kind: "en-passant",
      from: sq("d4"),
      to: sq("c3"),
      capturedPawnSquare: sq("c4"),
    });
    expect(result.accepted).toBe(false);
  });
});

// ── materializedSquares tracking ─────────────────────────────────────────────

describe("§2.8 materializedSquares in ReplayedMove", () => {
  it("an Option-A move does NOT report the moved dude as a materialized king", () => {
    // e8 slides to b8 ({R,Q}); it stays a dude, so b8 is not in materializedSquares.
    const state = buildState(`
      8 d . . . d . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("b8") });
    expect(result.accepted).toBe(true);
    expect(result.replayedMove.materializedSquares).not.toContain(sq("b8"));
    expect(result.nextState.board[sq("b8")]?.kind).toBe("dude");
  });
});

// ── Interaction with king-eager propagation ──────────────────────────────────

describe("§2.8 interaction with propagate", () => {
  it("a lone king-eligible dude eager-materializes as king before §2.8 applies", () => {
    // Six black dudes cannot be king ({R,N,B}); only e8 can. King-eager forces
    // e8 to materialize as king on parse, so it is a real king under check, not
    // a king-candidate — and §2.8 never needs to fire.
    const state = buildState(`
      8 d[rnb] d[rnb] d[rnb] d[rnb] d . d[rnb] d[rnb]
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . K .
      turn: black
      castling: -
    `);
    const cell = state.board[sq("e8")];
    expect(cell?.kind).toBe("materialized");
    if (cell?.kind === "materialized") {
      expect(cell.piece).toBe("K");
    }
    expect(findKingCandidateUnderAttack(state, "black")).toBeNull();
  });
});
