import type { Move } from "@pwnd/core";
import type { GameSession, Transport } from "./Transport.js";

const KEY_PREFIX = "pwnd:game:";

export class LocalStorageTransport implements Transport {
  private key(gameId: string): string {
    return `${KEY_PREFIX}${gameId}`;
  }

  async loadSession(gameId: string): Promise<GameSession | null> {
    const raw = localStorage.getItem(this.key(gameId));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as GameSession;
    } catch {
      return null;
    }
  }

  async saveSession(session: GameSession): Promise<void> {
    localStorage.setItem(this.key(session.gameId), JSON.stringify(session));
  }

  async appendMove(gameId: string, move: Move): Promise<void> {
    const session = await this.loadSession(gameId);
    if (session === null) return;
    session.moves.push(move);
    await this.saveSession(session);
  }

  async deleteSession(gameId: string): Promise<void> {
    localStorage.removeItem(this.key(gameId));
  }
}
