import type { Move } from "@pwnd/core";
import type { GameSession, Transport } from "./Transport.js";

/**
 * Stub HTTP transport. All methods throw "not implemented".
 * Placeholder for the future server integration.
 */
export class HttpTransport implements Transport {
  async loadSession(_gameId: string): Promise<GameSession | null> {
    throw new Error("HttpTransport: not implemented");
  }

  async saveSession(_session: GameSession): Promise<void> {
    throw new Error("HttpTransport: not implemented");
  }

  async appendMove(_gameId: string, _move: Move): Promise<void> {
    throw new Error("HttpTransport: not implemented");
  }

  async deleteSession(_gameId: string): Promise<void> {
    throw new Error("HttpTransport: not implemented");
  }
}
