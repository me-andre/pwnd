# AGENTS.md — packages/core

## Purpose
Pure TypeScript game-logic library. No React, no DOM, no side effects.

## API surface
All public functions are exported from `src/index.ts`. Do not add new public exports without updating `index.ts`.

## Coding style
- All multi-param public functions take a **single options object** (named-arg style).
- Functions are **pure**: given the same input they return the same output, no mutations.
- Prefer `const` and immutable updates (`{ ...state, field: newValue }`).

## State discipline ("prefer raw")
- `GameState.board` stores raw data only: `Cell[64]`, each cell either empty or `{ owner, kind }`.
- `kind` is either a materialized piece letter (`'R'|'N'|'B'|'Q'|'K'|'P'`) or a dude descriptor carrying its **local candidate set only**.
- **Effective candidate set** (local ∩ global constraints) is always **computed on demand**, never stored.
- Never store derived/computed data in `GameState`.

## Union shape rule
Same as root AGENTS.md: all-primitive or all-object discriminated unions. No mixing.

## Tests
- Every test constructs board state via the **state-builder** (`test/state-builder.ts`).
- No mocks, no stubs — all test inputs are state-builder literals.
- Test file names: `*.test.ts` under `test/`.
- Coverage target: every rule in CONCEPT.md §2.1–2.9.

## STATE_FORMAT.md
The state-builder literal format is documented in `STATE_FORMAT.md`. Keep it in sync with the parser.
