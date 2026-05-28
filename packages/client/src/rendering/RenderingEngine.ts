import type { GameState, ReplayedMove, Side } from "@pwnd/core";
import type { ReactNode } from "react";

export interface RenderOptions {
  gameState: GameState;
  replayedMove: ReplayedMove | null;
  /** The side whose pieces face the player (board is rotated if "black"). */
  facePlayer: Side;
  selectedSquare: number | null;
  legalDestinations: number[];
  /**
   * Square of the piece currently under check for the side to move: a
   * king-candidate dude under attack, or a materialized king in check. Rendered
   * with a red tint. `null` when no one is in check.
   */
  checkSquare: number | null;
  onSquareClick: (squareIndex: number) => void;
}

export interface RenderingEngine {
  render(options: RenderOptions): ReactNode;
}
