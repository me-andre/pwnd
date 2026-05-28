import type { GameState, ReplayedMove, Side } from "@pwnd/core";
import type { ReactNode } from "react";

export interface RenderOptions {
  gameState: GameState;
  replayedMove: ReplayedMove | null;
  /** The side whose pieces face the player (board is rotated if "black"). */
  facePlayer: Side;
  selectedSquare: number | null;
  legalDestinations: number[];
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
