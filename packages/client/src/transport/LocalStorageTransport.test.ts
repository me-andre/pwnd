import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageTransport } from "./LocalStorageTransport.js";
import type { GameSession } from "./Transport.js";

describe("LocalStorageTransport", () => {
  let transport: LocalStorageTransport;

  beforeEach(() => {
    localStorage.clear();
    transport = new LocalStorageTransport();
  });

  it("returns null for unknown gameId", async () => {
    expect(await transport.loadSession("no-such-id")).toBeNull();
  });

  it("saves and loads a session", async () => {
    const session: GameSession = {
      gameId: "test-1",
      mode: "hotseat",
      createdAt: "2026-01-01T00:00:00Z",
      moves: [],
    };
    await transport.saveSession(session);
    const loaded = await transport.loadSession("test-1");
    expect(loaded).toEqual(session);
  });

  it("appendMove adds move to session", async () => {
    const session: GameSession = {
      gameId: "test-2",
      mode: "tablet",
      createdAt: "2026-01-01T00:00:00Z",
      moves: [],
    };
    await transport.saveSession(session);

    const move = { kind: "normal" as const, from: 8, to: 16 };
    await transport.appendMove("test-2", move);

    const loaded = await transport.loadSession("test-2");
    expect(loaded?.moves).toHaveLength(1);
    expect(loaded?.moves[0]).toEqual(move);
  });

  it("deleteSession removes session", async () => {
    const session: GameSession = {
      gameId: "test-3",
      mode: "solo",
      createdAt: "2026-01-01T00:00:00Z",
      moves: [],
    };
    await transport.saveSession(session);
    await transport.deleteSession("test-3");
    expect(await transport.loadSession("test-3")).toBeNull();
  });
});
