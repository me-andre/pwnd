# AGENTS.md — packages/client

## Purpose
Vite + React 19 browser app. Consumes `@pwnd/core` for all game logic.

## Routing
TanStack file-based router. Routes live in `src/routes/`.
- `__root.tsx` — shared layout, MUI theme provider.
- `index.tsx` — main menu (4 mode buttons).
- `game.$gameId.tsx` — game view, reads `?mode=tablet|solo|hotseat`.
- `network.tsx` — "Not implemented yet" stub.

## State model
- Game state is reconstructed from a move log on every render: start from `createInitialState()`, fold `applyMove` over `moves`.
- Session UI state (selected square, highlighted squares) is React component state.
- No global state library. React Context if cross-cutting needs emerge.

## Persistence
`LocalStorageTransport` stores `{ createdAt, mode, moves }` under key `pwnd:game:<gameId>`.

## Transport seam
`src/transport/Transport.ts` defines the interface. `LocalStorageTransport` is the MVP implementation. `HttpTransport` is a stub class (throws "not implemented").

## Rendering engine
`RenderingEngine` interface in `src/rendering/RenderingEngine.ts`.
`ThreeRenderingEngine` (in `src/rendering/three/`) is the 3D implementation: Three.js / react-three-fiber
`<Canvas>` with a wooden PBR board (FBX + WebP maps), metallic pieces, OrbitControls for free camera
rotation, and damped auto-facing that smoothly turns the board toward the current player on each turn.
`DomRenderingEngine` has been removed.

## Equality checks
Same as root AGENTS.md: always `===` / `!==`; never `==` / `!=`. When `noUncheckedIndexedAccess`
widens an array element type to `T | undefined`, add an explicit `=== undefined` guard at the
call site rather than using loose `!= null`.

## Union shape rule
Same as root AGENTS.md: homogeneous discriminated unions only.
