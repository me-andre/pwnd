# State Builder Format

The state-builder (`test/state-builder.ts`) parses a compact ASCII board literal into a `GameState`. This format is used exclusively in tests — no mocks, no stubs.

## Syntax

```
8 . . . . . . . .
7 p p p p p p p p
6 . . . . . . . .
5 . . . . . . . .
4 . . . . . . . .
3 . . . . . . . .
2 P P P P P P P P
1 D D D D D D D D
  a b c d e f g h
turn: white
castling: KQkq
```

### Cell tokens

| Token | Meaning |
|---|---|
| `.` | Empty square |
| `P` / `p` | White / black pawn |
| `R` / `r` | Materialized white / black rook |
| `N` / `n` | Materialized white / black knight |
| `B` / `b` | Materialized white / black bishop |
| `Q` / `q` | Materialized white / black queen |
| `K` / `k` | Materialized white / black king |
| `D` | White dude — full superposition `{R,N,B,Q,K}` |
| `d` | Black dude — full superposition `{R,N,B,Q,K}` |
| `D[RNBQK]` | White dude with listed local candidates (e.g. `D[BQK]`) |
| `d[rnbqk]` | Black dude with listed local candidates (e.g. `d[bqk]`) |

### Metadata lines

- `turn: white` or `turn: black` — whose ply it is (default: white).
- `castling: KQkq` — standard FEN castling flags. `K` = white king-side, `Q` = white queen-side, `k` = black king-side, `q` = black queen-side. Use `-` for none. Default: `KQkq`.
- `enPassant: e3` — en-passant target square (optional; default: none).
- `result: ongoing` | `result: win white` | `result: win black` | `result: draw` (default: ongoing).

### Notes

- The board is written rank 8 down to rank 1 (matching standard orientation).
- After parsing, the state-builder runs `propagate()` once to apply initial global constraints, matching the game's live behaviour.
- `moveLog` is always empty in a parsed state (no history is captured).
