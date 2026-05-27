/**
 * Pure movement-primitive helpers.
 *
 * Each function returns the squares reachable by a given piece type from a
 * given square on an EMPTY board (no blocking, no board state). Callers apply
 * blocking and capture rules on top.
 *
 * These are also used as reverse queries: "which piece types could make a move
 * from A to B?" — answered by checking each type's reachable set.
 */

import { fileOf, offset, rankOf } from "./squares.js";
import type { DudeKind, SquareIndex } from "./types.js";

// ── Sliding helpers ───────────────────────────────────────────────────────────

function slide(from: SquareIndex, dirs: [number, number][]): SquareIndex[] {
  const result: SquareIndex[] = [];
  for (const [df, dr] of dirs) {
    let cur: SquareIndex | null = from;
    for (let step = 0; step < 7; step++) {
      cur = offset(cur, df, dr);
      if (cur === null) break;
      result.push(cur);
    }
  }
  return result;
}

// ── Per-type raw square lists (empty board) ───────────────────────────────────

export function rookSquares(from: SquareIndex): SquareIndex[] {
  return slide(from, [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]);
}

export function bishopSquares(from: SquareIndex): SquareIndex[] {
  return slide(from, [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]);
}

export function queenSquares(from: SquareIndex): SquareIndex[] {
  return [...rookSquares(from), ...bishopSquares(from)];
}

export function knightSquares(from: SquareIndex): SquareIndex[] {
  const deltas: [number, number][] = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ];
  return deltas.flatMap((d) => {
    const sq = offset(from, d[0], d[1]);
    return sq !== null ? [sq] : [];
  });
}

export function kingSquares(from: SquareIndex): SquareIndex[] {
  const deltas: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  return deltas.flatMap((d) => {
    const sq = offset(from, d[0], d[1]);
    return sq !== null ? [sq] : [];
  });
}

// ── Reverse query ─────────────────────────────────────────────────────────────

/**
 * Return the set of DudeKind values that could make the move `from → to` on an
 * empty board (geometry only; no legality/blocking).
 */
export function dudeKindsForMove(from: SquareIndex, to: SquareIndex): DudeKind[] {
  const result: DudeKind[] = [];
  if (rookSquares(from).includes(to)) result.push("R");
  if (knightSquares(from).includes(to)) result.push("N");
  if (bishopSquares(from).includes(to)) result.push("B");
  if (queenSquares(from).includes(to)) result.push("Q");
  if (kingSquares(from).includes(to)) result.push("K");
  return result;
}

// ── Reachable squares WITH blocking ──────────────────────────────────────────

type OccupiedFn = (sq: SquareIndex) => boolean;
type FriendlyFn = (sq: SquareIndex) => boolean;

function slideBlocked(
  from: SquareIndex,
  dirs: [number, number][],
  isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  const result: SquareIndex[] = [];
  for (const [df, dr] of dirs) {
    let cur: SquareIndex | null = from;
    for (let step = 0; step < 7; step++) {
      cur = offset(cur, df, dr);
      if (cur === null) break;
      if (isFriendly(cur)) break; // blocked by own piece
      result.push(cur); // capture or pass through empty
      if (isOccupied(cur)) break; // blocked after capture
    }
  }
  return result;
}

export function rookReachable(
  from: SquareIndex,
  isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  return slideBlocked(
    from,
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ],
    isOccupied,
    isFriendly,
  );
}

export function bishopReachable(
  from: SquareIndex,
  isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  return slideBlocked(
    from,
    [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ],
    isOccupied,
    isFriendly,
  );
}

export function queenReachable(
  from: SquareIndex,
  isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  return [
    ...rookReachable(from, isOccupied, isFriendly),
    ...bishopReachable(from, isOccupied, isFriendly),
  ];
}

export function knightReachable(
  from: SquareIndex,
  _isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  return knightSquares(from).filter((sq) => !isFriendly(sq));
}

export function kingReachable(
  from: SquareIndex,
  _isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  return kingSquares(from).filter((sq) => !isFriendly(sq));
}

export function pawnReachable(
  from: SquareIndex,
  side: "white" | "black",
  isOccupied: OccupiedFn,
  isEnemy: (sq: SquareIndex) => boolean,
  enPassantTarget: SquareIndex | null,
): SquareIndex[] {
  const result: SquareIndex[] = [];
  const dir = side === "white" ? 1 : -1;
  const startRank = side === "white" ? 1 : 6;

  // Single push
  const one = offset(from, 0, dir);
  if (one !== null && !isOccupied(one)) {
    result.push(one);
    // Double push from starting rank
    if (rankOf(from) === startRank) {
      const two = offset(from, 0, dir * 2);
      if (two !== null && !isOccupied(two)) result.push(two);
    }
  }

  // Captures (diagonal)
  for (const df of [-1, 1]) {
    const cap = offset(from, df, dir);
    if (cap !== null && (isEnemy(cap) || cap === enPassantTarget)) {
      result.push(cap);
    }
  }

  return result;
}

// ── Dude reachable (based on effective candidates) ────────────────────────────

export function dudeReachable(
  from: SquareIndex,
  effectiveCandidates: DudeKind[],
  isOccupied: OccupiedFn,
  isFriendly: FriendlyFn,
): SquareIndex[] {
  const seen = new Set<SquareIndex>();
  for (const kind of effectiveCandidates) {
    let squares: SquareIndex[];
    if (kind === "R") squares = rookReachable(from, isOccupied, isFriendly);
    else if (kind === "N") squares = knightReachable(from, isOccupied, isFriendly);
    else if (kind === "B") squares = bishopReachable(from, isOccupied, isFriendly);
    else if (kind === "Q") squares = queenReachable(from, isOccupied, isFriendly);
    else squares = kingReachable(from, isOccupied, isFriendly);

    for (const sq of squares) seen.add(sq);
  }
  return [...seen];
}

// ── Path helpers (for castling clear-path check) ──────────────────────────────

/** Return all squares strictly between two squares on the same rank (exclusive). */
export function squaresBetween(a: SquareIndex, b: SquareIndex): SquareIndex[] {
  const ra = rankOf(a);
  const rb = rankOf(b);
  const fa = fileOf(a);
  const fb = fileOf(b);
  if (ra !== rb && fa !== fb) return [];
  const result: SquareIndex[] = [];
  const df = Math.sign(fb - fa);
  const dr = Math.sign(rb - ra);
  let cur = a + dr * 8 + df;
  while (cur !== b) {
    result.push(cur);
    cur = cur + dr * 8 + df;
  }
  return result;
}
