/**
 * Labeled move sequences for visual QA snapshots.
 * Each scenario describes a game state for the renderer to visualize.
 */
import type { Move } from "@pwnd/core";

export interface Scenario {
  id: string;
  description: string;
  mode: "tablet" | "solo" | "hotseat";
  moves: Move[];
}

/** Starting position — no moves played */
const initial: Scenario = {
  id: "initial",
  description: "Initial board position",
  mode: "hotseat",
  moves: [],
};

/** White has moved e2→e4 (pawn opening, from index 12 to 28) */
const afterE4: Scenario = {
  id: "after-e4",
  description: "After 1. e4",
  mode: "hotseat",
  moves: [{ from: 12, to: 28 }],
};

/** Tablet mode — board always faces white */
const tabletInitial: Scenario = {
  id: "tablet-initial",
  description: "Tablet mode initial",
  mode: "tablet",
  moves: [],
};

/** Solo mode — board flips to face current player */
const soloAfterMove: Scenario = {
  id: "solo-after-move",
  description: "Solo mode: one move played, board facing black",
  mode: "solo",
  moves: [{ from: 12, to: 28 }],
};

/** A few moves to create mixed board state */
const midGame: Scenario = {
  id: "mid-game",
  description: "Mid game: e4 d5 Nf3",
  mode: "hotseat",
  // e4, d5, g1→f3 (knight move)
  moves: [
    { from: 12, to: 28 },
    { from: 51, to: 35 },
    { from: 6, to: 21 },
  ],
};

export const SCENARIOS: Scenario[] = [initial, afterE4, tabletInitial, soloAfterMove, midGame];
