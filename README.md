# Pawn and Dude
## Чувак и Пешка

A chess variant where all non-pawn pieces start as **Dudes** — pieces in quantum-like superposition over the five standard non-pawn types (Rook, Knight, Bishop, Queen, King). A Dude's identity is revealed gradually through movement.

## Quick start

```bash
pnpm install
pnpm dev          # starts the client at http://localhost:5173
pnpm test         # runs all tests across packages
```

## How it works

1. **Dudes in superposition**: Every back-rank piece starts as a Dude (⬡), holding a candidate set `{R, N, B, Q, K}`.
2. **Narrowing via moves**: Moving a Dude narrows its candidates to the piece types geometrically compatible with that move (e.g. moving like a knight narrows to `{N}`, immediately materializing).
3. **Materialization**: A Dude with only one candidate type left becomes that piece permanently.
4. **King rule**: If only one Dude can still be a King across all remaining Dudes for a side, it materializes as King immediately (eager propagation).
5. **Queen rule**: At most one queen per side. If the queen is captured, the Queen candidate type reopens for all surviving Dudes whose local candidate set still contains Q.
6. **Castling**: Any unmoved back-rank Dude that can still be a Rook may partner with the king for castling. Both pieces materialize during the move.
7. **Check**: An attack on a Dude whose candidate set contains King creates a "king-candidate under check" — must be resolved like standard check.
8. **Promotion**: A pawn reaching the back rank promotes to a new Dude (not a chosen piece).

## Game modes

| Mode | Description |
|---|---|
| **Hot-seat** | Two players, one device. Board flips between turns. |
| **Tablet** | Board stays fixed — play on a flat tablet between two players. |
| **Solo** | Practice against yourself, board rotates with each ply. |
| Network | Planned for a future release (shows "Not implemented" stub). |

## Repo layout

```
packages/core/    Pure TypeScript game logic. No React/DOM.
packages/client/  Vite + React 19 + MUI browser app.
```

## Architecture

- **Core**: Functional, pure. `applyMove` → propagate fixed-point → result.
- **Client**: Game state is always reconstructed from the move log. Persistence via `localStorage`.
- **Transport seam**: `Transport` interface with `LocalStorageTransport` (MVP) and `HttpTransport` stub (future server).
- **Rendering**: `RenderingEngine` interface → `DomRenderingEngine` (CSS grid + MUI).

See `CONCEPT.md` for the full ruleset and `AGENTS.md` files for architecture and coding conventions.
