# AGENTS.md — Root

## Repo layout

```
packages/core/    Pure TS game logic library. No React/DOM.
packages/client/  Vite + React 19 app.
```

## Conventions

### TypeScript
- `tsconfig.base.json` at root; each package extends it.
- `strict: true`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.

### Union shape rule
Keep union members homogeneous in shape. A union is either **all primitives** or **all objects**. If any single case needs an object, every case becomes a discriminated-union object (tagged on `status`/`kind`/`type`). No mixing primitives with objects in one union.

**Bad:** `'ongoing' | { winner: Side } | 'draw'`
**Good:** `{ status: 'ongoing' } | { status: 'win'; winner: Side } | { status: 'draw' }`

### Linting / formatting
Biome (`biome.json` at root). Run `pnpm lint` before committing.

### Tests
Vitest. Root config delegates to `packages/*/vitest.config.ts`. Run `pnpm test` from root.

### Equality checks
Always use `===` and `!==`. Never use `==` or `!=`. When a value may be `null | undefined`
(e.g. from `noUncheckedIndexedAccess`), add a specific `=== undefined` guard first, then
assert the remaining value with `!== null`. Name what you are checking — be as specific as
the type allows rather than relying on falsy/truthy coercion.

### Style
- Named-argument style for functions with ≥2 parameters: pass a single options object.
- Prefer pure functions; avoid mutations.
- No global state libraries unless the need is demonstrated — React Context before Redux.

## Package-specific rules
See `packages/core/AGENTS.md` and `packages/client/AGENTS.md`.
