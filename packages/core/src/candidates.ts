/**
 * Candidate-set helpers.
 *
 * "Local" candidates are stored on the Dude itself and only shrink due to
 * moves the dude makes. They NEVER shrink due to global constraints.
 * "Effective" candidates are computed on demand: local ∩ (ALL − global exclusions).
 */

import type { Cell, DudeKind, Side } from "./types.js";
import { ALL_DUDE_KINDS } from "./types.js";

// ── Global constraint helpers ─────────────────────────────────────────────────

/** Return true if a materialized queen for `side` is alive on the board. */
export function hasLiveQueen(board: ReadonlyArray<Cell>, side: Side): boolean {
  return board.some(
    (c) => c !== null && c.kind === "materialized" && c.owner === side && c.piece === "Q",
  );
}

/** Return true if a materialized king for `side` is alive on the board. */
export function hasLiveKing(board: ReadonlyArray<Cell>, side: Side): boolean {
  return board.some(
    (c) => c !== null && c.kind === "materialized" && c.owner === side && c.piece === "K",
  );
}

/**
 * Compute the global exclusions for `side` given the current board state.
 * Returns the set of DudeKind values that are globally disallowed for new
 * materializations.
 */
export function globalExclusions(board: ReadonlyArray<Cell>, side: Side): Set<DudeKind> {
  const excl = new Set<DudeKind>();
  if (hasLiveQueen(board, side)) excl.add("Q");
  if (hasLiveKing(board, side)) excl.add("K");
  return excl;
}

/**
 * Compute the effective candidate set for a dude: local ∩ (ALL − global
 * exclusions). Local candidates are NEVER modified here.
 */
export function effectiveCandidates(
  localCandidates: ReadonlyArray<DudeKind>,
  board: ReadonlyArray<Cell>,
  side: Side,
): DudeKind[] {
  const excl = globalExclusions(board, side);
  return localCandidates.filter((k) => !excl.has(k));
}

/**
 * Widen a local candidate set for a freshly promoted dude: start with ALL and
 * apply global constraints immediately.
 */
export function widestLocalCandidates(board: ReadonlyArray<Cell>, side: Side): DudeKind[] {
  const excl = globalExclusions(board, side);
  return ALL_DUDE_KINDS.filter((k) => !excl.has(k));
}

// ── Propagation ───────────────────────────────────────────────────────────────

export type PropagateResult = {
  board: ReadonlyArray<Cell>;
  materializedSquares: number[];
};

/**
 * Run one pass of global propagation:
 * 1. Recompute effective sets for all dudes (local ∩ global constraints).
 * 2. Materialize any dude whose effective set is a singleton.
 *    - Materializing a queen may remove Q from other dudes' effective sets.
 *    - Materializing a king removes K from all other dudes' effective sets.
 * 3. Apply king-eager: if only one dude across the entire side still has K in
 *    its effective set (and no king is materialized), force-materialize it.
 *
 * IMPORTANT: local candidates are NEVER narrowed by global constraints.
 * Queen re-admission works because effective = local ∩ global: when the queen
 * is captured, the global exclusion lifts and the local set (unchanged) makes
 * Q reappear in effective.
 *
 * Returns the new board and which squares were materialized (may be empty).
 * The caller must loop until no new materializations occur.
 */
export function propagatePass(
  board: ReadonlyArray<Cell>,
  materializedSquares: number[] = [],
): PropagateResult {
  const cells = [...board] as Cell[];
  let changed = false;

  // Singleton-effective materialize.
  // We iterate multiple times within a single pass so that a newly materialized
  // queen immediately reduces other dudes' effective sets in the same pass.
  let innerChanged = true;
  while (innerChanged) {
    innerChanged = false;
    for (let i = 0; i < 64; i++) {
      const cell = cells[i];
      if (cell === null || cell.kind !== "dude") continue;
      const eff = effectiveCandidates(cell.localCandidates, cells, cell.owner);
      if (eff.length === 0) continue; // illegal state
      if (eff.length === 1) {
        const piece = eff[0] as NonNullable<(typeof eff)[0]>;
        cells[i] = { kind: "materialized", owner: cell.owner, piece };
        materializedSquares.push(i);
        changed = true;
        innerChanged = true;
      }
    }
  }

  // King-eager: if no king materialized for a side, find all dudes whose
  // effective set still contains K. If exactly one → materialize as king.
  for (const side of ["white", "black"] as Side[]) {
    if (hasLiveKing(cells, side)) continue;
    const kingCandidates: number[] = [];
    for (let i = 0; i < 64; i++) {
      const cell = cells[i];
      if (cell === null || cell.kind !== "dude" || cell.owner !== side) continue;
      const eff = effectiveCandidates(cell.localCandidates, cells, side);
      if (eff.includes("K")) kingCandidates.push(i);
    }
    if (kingCandidates.length === 1) {
      const idx = kingCandidates[0]!;
      const cell = cells[idx] as import("./types.js").Dude;
      cells[idx] = { kind: "materialized", owner: side, piece: "K" };
      materializedSquares.push(idx);
      changed = true;
      // Re-run singleton check (newly materialized king may cause Q-only dude
      // to materialize etc.)
      innerChanged = true;
      while (innerChanged) {
        innerChanged = false;
        for (let i = 0; i < 64; i++) {
          if (i === idx) continue;
          const c = cells[i];
          if (c === null || c.kind !== "dude" || c.owner !== side) continue;
          const eff = effectiveCandidates(c.localCandidates, cells, c.owner);
          if (eff.length === 1) {
            cells[i] = {
              kind: "materialized",
              owner: c.owner,
              piece: eff[0] as import("./types.js").DudeKind,
            };
            materializedSquares.push(i);
            changed = true;
            innerChanged = true;
          }
        }
      }
    }
  }

  return { board: cells, materializedSquares };
}

/**
 * Run propagatePass until fixed point (no new materializations in a pass).
 * Returns the stable board and ALL squares materialized across all passes.
 */
export function propagate(board: ReadonlyArray<Cell>): PropagateResult {
  let current = board;
  const allMaterialized: number[] = [];

  for (let iter = 0; iter < 64; iter++) {
    const before = JSON.stringify(current);
    const result = propagatePass(current, []);
    current = result.board;
    allMaterialized.push(...result.materializedSquares);
    const after = JSON.stringify(current);
    if (before === after) break;
  }

  return { board: current, materializedSquares: allMaterialized };
}
