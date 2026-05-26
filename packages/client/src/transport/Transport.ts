import type { Move } from "@pwnd/core";

export type GameMode = "tablet" | "solo" | "hotseat";

export interface GameSession {
  gameId: string;
  mode: GameMode;
  createdAt: string;
  moves: Move[];
}

export interface Transport {
  /** Load a session by ID. Returns null if not found. */
  loadSession(gameId: string): Promise<GameSession | null>;
  /** Save (create or update) a session. */
  saveSession(session: GameSession): Promise<void>;
  /** Append a move to an existing session's move log. */
  appendMove(gameId: string, move: Move): Promise<void>;
  /** Delete a session. */
  deleteSession(gameId: string): Promise<void>;
}
