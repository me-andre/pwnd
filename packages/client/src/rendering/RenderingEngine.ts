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
   * Squares of every piece currently under check for the side to move: each
   * king-candidate dude under attack, plus a materialized king in check. A
   * single attacker can fork several at once. All are rendered with a red tint.
   * Empty when no one is in check.
   */
  checkSquares: number[];
  onSquareClick: (squareIndex: number) => void;
  /**
   * When true, renders with an orthographic camera looking at the board from
   * the rank-numbers side (symmetric for both players, no OrbitControls).
   */
  tabletMode: boolean;
}

export interface RenderingEngine {
  render(options: RenderOptions): ReactNode;
}
