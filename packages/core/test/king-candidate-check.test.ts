/**
 * Tests for the king-candidate check mechanic.
 *
 * When an opponent attacks a dude whose effective candidate set contains king,
 * that dude is a "king-candidate under check" — it might BE the king, so it may
 * not be left under attack. The single legality rule:
 *
 *   A move is permitted unless it leaves a dude that still carries K (or a
 *   materialized king) under attack.
 *
 * Crucially, resolving a check does NOT generally reveal the king:
 *
 *   - Capturing the attacker leaves the threatened dudes in superposition.
 *   - Blocking with another piece leaves them in superposition (any piece can
 *     be shielded). It only collapses if narrowing/king-eager forces it.
 *   - A king-ish evasion (a one-square move another piece could also make)
 *     stays in superposition; it collapses to king only when ordinary geometry
 *     leaves K as the sole candidate (then king-eager / singleton applies).
 *
 * The ONE forced collapse: if a dude that was under attack evades king-ishly
 * (kept K, now safe) while OTHER dudes-with-K are still left under attack, the
 * evader is forced to become the king. Becoming the king strips K from every
 * friendly dude, dissolving the siblings' checks.
 *
 * IMPORTANT FIXTURE NOTE: a side with no materialized king and exactly one
 * dude still carrying K eagerly materializes that dude as king (king-eager
 * propagation). To keep a dude as a *king-candidate*, fixtures give the side at
 * least TWO king-candidate dudes, so neither collapses on parse.
 */

import { describe, expect, it } from "vitest";
import {
  applyMove,
  findKingCandidateUnderAttack,
  getLegalMoves,
  isCheckmate,
} from "../src/apply-move.js";
import { effectiveCandidates } from "../src/candidates.js";
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

// ── Block → collapse only via king-eager (blocker forced off K) ───────────────

describe("blocking the attack does not reveal the king directly", () => {
  it("blocker steps onto the rook's line, sheds K, leaving the original as sole king", () => {
    // White rook on e1 attacks black dude on e8. The only block squares are on
    // the e-file, which the rook attacks — so the blocker (d7→e7) moves into the
    // attack and sheds K ("под бой"). That leaves e8 as the sole king-candidate,
    // which king-eager then materializes. The collapse is king-eager, not a
    // forced reveal of the blocked dude.
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

  it("the king-eager square is reported in materializedSquares", () => {
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

  it("with a spare king-candidate, a block leaves everyone in superposition", () => {
    // e8 (subject) is attacked by the rook on e1; d7 blocks via e7 (sheds K).
    // A spare king-candidate sits safely on a4 (off the e-file and rank 1), so
    // after the block TWO dudes still carry K (e8 shielded + a4 spare).
    // King-eager does not fire and e8 stays a king-candidate dude.
    const state = buildState(`
      8 . . . . d . . .
      7 . . . d . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 d . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . R . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("d7"), to: sq("e7") });
    expect(result.accepted).toBe(true);
    expect(result.nextState.board[sq("e8")]?.kind).toBe("dude");
    expect(result.nextState.board[sq("a4")]?.kind).toBe("dude");
  });
});

// ── Capturing the attacker → threatened dudes stay in superposition ───────────

describe("capturing the attacker leaves the threatened dude in superposition", () => {
  it("a rook captures the attacker → attacked dude stays an undecided king-candidate", () => {
    // White rook on e1 attacks black dude on e8. Black rook on h1 captures it
    // (path f1,g1 clear). The threat is gone, so e8 need not prove anything: it
    // (and the a8 spare) remain king-candidate dudes.
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
    const cell = result.nextState.board[sq("e8")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(effectiveCandidates(cell.localCandidates, result.nextState.board, "black")).toContain(
        "K",
      );
    }
  });

  it("a pawn captures the attacker → attacked dude stays an undecided king-candidate", () => {
    // White rook on d5 attacks black dude on d8 (d6,d7 clear). Black pawn on e6
    // captures the rook. d8 (and the a8 spare) stay king-candidate dudes.
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
    const cell = result.nextState.board[sq("d8")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(effectiveCandidates(cell.localCandidates, result.nextState.board, "black")).toContain(
        "K",
      );
    }
  });
});

// ── King-ish evasion to safety → stays in superposition (no reveal) ───────────

describe("a king-ish evasion does not reveal the king when another piece could make it", () => {
  it("attacked dude steps one square diagonally off the attack line → stays a dude", () => {
    // White rook on e1 attacks black dude on e8. e8 steps to d7 (one-square
    // diagonal → {B,Q,K}); off the e-file, safe. A bishop or queen could also
    // have made that step, and no other king-candidate is left attacked (a8 is
    // safe), so it stays an undecided king-candidate dude.
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
    const cell = result.nextState.board[sq("d7")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(effectiveCandidates(cell.localCandidates, result.nextState.board, "black")).toContain(
        "K",
      );
    }
  });

  it("attacked dude steps one square forward off the attack line → stays a dude", () => {
    // White bishop on h5 attacks black dude on e8 (g6,f7 clear). e8 steps to e7
    // (one square forward → {R,Q,K}); off the diagonal, safe. A rook/queen could
    // also make the step, so it stays a king-candidate dude.
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
    const cell = result.nextState.board[sq("e7")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(effectiveCandidates(cell.localCandidates, result.nextState.board, "black")).toContain(
        "K",
      );
    }
  });

  it("a king-ish evasion whose only matching candidate is K still materializes", () => {
    // A {N,K} dude on e8 attacked by the rook on e1. Its one-square step to d7
    // matches only K (a knight can't step one diagonal), so geometry collapses
    // it to {K} → king. The a8 spare keeps it from collapsing on parse.
    const state = buildState(`
      8 d . . . d[nk] . . .
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
    const cell = result.nextState.board[sq("d7")];
    expect(cell?.kind).toBe("materialized");
    if (cell?.kind === "materialized") {
      expect(cell.piece).toBe("K");
    }
  });
});

// ── Legality: bad / non-resolving responses are illegal ───────────────────────

describe("§2.8 legality — moves that leave the materialized king in check are rejected", () => {
  it("an unrelated move is rejected because it leaves a king-candidate attacked", () => {
    // White rook on e1 attacks black dude on e8. Black pushes an unrelated pawn
    // a7→a6: e8 is left under attack while still carrying K → illegal.
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
  it("attacked dude: moves that resolve the attack are legal", () => {
    // White rook on e1 attacks e8.
    //  - f6 (knight): sheds K → legal.
    //  - d7 (one-square diagonal, off e-file & safe): stays a king-candidate
    //    dude on a safe square → legal.
    //  - e7 (one-square forward, still on the e-file → attacked): a king cannot
    //    step into the rook's line, so the dude sheds K (moves as a rook/queen);
    //    the king identity passes to the a8 spare → legal.
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
    expect(toSquares).toContain(sq("e7"));
  });

  it("a blocker's legal moves include only those that actually cover the attack", () => {
    // White rook on e1 attacks e8. Black dude d7:
    //  - e7 blocks the e-file → legal.
    //  - c6 does not block → e8 left as an attacked king-candidate → illegal.
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

// ── "King cannot move into check": moving into an attacked square sheds K ─────

describe("moving a dude into an attacked square removes K", () => {
  it("a dude that steps into an attacked square sheds K (a king could not go there)", () => {
    // Black dude c6 (king-candidate; h8 spare keeps it from eager-collapsing)
    // steps to c5, which is attacked by the white rook on a5. A king could not
    // move into the rook's line, so the dude proves it is not the king: K is
    // removed and it stays a {R,Q} dude.
    const state = buildState(`
      8 . . . . . . . d
      7 . . . . . . . .
      6 . . d . . . . .
      5 R . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . K
      turn: black
      castling: -
    `);
    expect(findKingCandidateUnderAttack(state, "black")).toBeNull(); // not yet a check
    const result = applyMove(state, { kind: "normal", from: sq("c6"), to: sq("c5") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("c5")];
    expect(cell?.kind).toBe("dude");
    if (cell?.kind === "dude") {
      expect(cell.localCandidates).not.toContain("K");
      expect(cell.localCandidates).toEqual(expect.arrayContaining(["R", "Q"]));
    }
  });

  it("a dude that steps onto a SAFE square keeps K (and here materializes as king)", () => {
    // Same shape, but c6 is a {N,K} dude stepping to c7 (a safe square). The
    // only candidate compatible with a one-square move is K, and c7 is not
    // attacked, so it materializes as king.
    const state = buildState(`
      8 . . . . . . . d
      7 . . . . . . . .
      6 . . d[nk] . . . . .
      5 R . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("c6"), to: sq("c7") });
    expect(result.accepted).toBe(true);
    const cell = result.nextState.board[sq("c7")];
    expect(cell?.kind).toBe("materialized");
    if (cell?.kind === "materialized") {
      expect(cell.piece).toBe("K");
    }
  });

  it("a dude whose only move-compatible candidate is K cannot step into an attacked square", () => {
    // A {N,K} dude on c6: a one-square step matches only K. Stepping to c5
    // (attacked by the a5 rook) would require it to be a king moving into check,
    // which is illegal — so the move is rejected and not offered as legal.
    const state = buildState(`
      8 . . . . . . . d
      7 . . . . . . . .
      6 . . d[nk] . . . . .
      5 R . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . K
      turn: black
      castling: -
    `);
    const toSquares = getLegalMoves(state, sq("c6")).map((m) => m.to);
    expect(toSquares).not.toContain(sq("c5"));
    const result = applyMove(state, { kind: "normal", from: sq("c6"), to: sq("c5") });
    expect(result.accepted).toBe(false);
  });

  it("a king-candidate under check escapes by stepping into the attack as a rook/queen", () => {
    // White rook e1 attacks e8 (king-candidate check). e8 steps to e7 — still on
    // the e-file, so a king could not go there. The dude sheds K (moves as a
    // rook/queen) and the king identity passes to the a8 spare. Legal.
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
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("e7") });
    expect(result.accepted).toBe(true);
    const moved = result.nextState.board[sq("e7")];
    expect(moved?.kind).toBe("dude");
    if (moved?.kind === "dude") {
      expect(moved.localCandidates).not.toContain("K");
    }
    const king = result.nextState.board[sq("a8")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
    }
  });
});

// ── Fork: one attacker checks several king-candidates at once ─────────────────

describe("fork — a single attacker checks multiple king-candidates", () => {
  // White queen on e4 forks two black king-candidates: e8 (up the e-file) and
  // a8 (up the e4–a8 diagonal). A black knight on c3 can capture the queen.
  const forkBoard = `
    8 d . . . d . . .
    7 . . . . . . . .
    6 . . . . . . . .
    5 . . . . . . . .
    4 . . . . Q . . .
    3 . . n . . . . .
    2 . . . . . . . .
    1 K . . . . . . .
    turn: black
    castling: -
  `;

  it("both forked dudes are detected as king-candidates under attack", () => {
    const state = buildState(forkBoard);
    expect(findKingCandidateUnderAttack(state, "black")).not.toBeNull();
    // e8 and a8 are both attacked king-candidates.
    expect(getLegalMoves(state, sq("c3")).map((m) => m.to)).toContain(sq("e4"));
  });

  it("capturing the attacker leaves BOTH forked dudes in superposition", () => {
    // The knight (not a king-candidate) captures the queen. Threat gone; neither
    // dude is forced to reveal, so both stay king-candidate dudes.
    const state = buildState(forkBoard);
    const result = applyMove(state, { kind: "normal", from: sq("c3"), to: sq("e4") });
    expect(result.accepted).toBe(true);
    const board = result.nextState.board;
    for (const square of ["a8", "e8"] as const) {
      const cell = board[sq(square)];
      expect(cell?.kind).toBe("dude");
      if (cell?.kind === "dude") {
        expect(effectiveCandidates(cell.localCandidates, board, "black")).toContain("K");
      }
    }
  });

  it("a king-ish evasion by one forked dude crowns it and strips K from the sibling", () => {
    // e8 steps to d7 (one-square diagonal, kept K, safe). a8 is still attacked,
    // so the evader is forced to become the king — and a8 loses K.
    const state = buildState(forkBoard);
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("d7") });
    expect(result.accepted).toBe(true);
    const board = result.nextState.board;
    const king = board[sq("d7")];
    expect(king?.kind).toBe("materialized");
    if (king?.kind === "materialized") {
      expect(king.piece).toBe("K");
    }
    const sibling = board[sq("a8")];
    expect(sibling?.kind).toBe("dude");
    if (sibling?.kind === "dude") {
      expect(effectiveCandidates(sibling.localCandidates, board, "black")).not.toContain("K");
    }
    expect(result.replayedMove.materializedSquares).toContain(sq("d7"));
  });

  it("shedding K on one forked dude while the sibling stays attacked is illegal", () => {
    // e8 jumps to f6 (knight, sheds K). a8 becomes the sole king-candidate via
    // king-eager, but it is still attacked by the queen → illegal.
    const state = buildState(forkBoard);
    expect(getLegalMoves(state, sq("e8")).map((m) => m.to)).not.toContain(sq("f6"));
    const result = applyMove(state, { kind: "normal", from: sq("e8"), to: sq("f6") });
    expect(result.accepted).toBe(false);
  });

  it("an unrelated move that does not break the fork is illegal", () => {
    // The knight wanders to b5 instead of capturing; both dudes stay attacked.
    const state = buildState(forkBoard);
    const result = applyMove(state, { kind: "normal", from: sq("c3"), to: sq("b5") });
    expect(result.accepted).toBe(false);
  });

  it("a forked dude that captures the attacker king-ishly keeps both in superposition", () => {
    // White rook on a7 forks a8 (adjacent) and e7 (along rank 7). a8 captures
    // the rook with a one-square move; the threat to e7 vanishes too, so no
    // sibling is left attacked → no forced crown, both stay king-candidates.
    const state = buildState(`
      8 d . . . . . . .
      7 R . . . d . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 . . . . . . . K
      turn: black
      castling: -
    `);
    const result = applyMove(state, { kind: "normal", from: sq("a8"), to: sq("a7") });
    expect(result.accepted).toBe(true);
    const board = result.nextState.board;
    for (const square of ["a7", "e7"] as const) {
      const cell = board[sq(square)];
      expect(cell?.kind).toBe("dude");
      if (cell?.kind === "dude") {
        expect(effectiveCandidates(cell.localCandidates, board, "black")).toContain("K");
      }
    }
  });
});
