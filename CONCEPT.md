# Pawn and Dude — Concept

## 1. Initial understanding (from README)

**Pawn and Dude** (Чувак и Пешка) is a chess variant in which:

- The board, turn order, and pawns are standard chess.
- Every non-pawn piece starts as an **"undefined dude"** — a piece in quantum-like superposition over the set of standard non-pawn piece types (rook, knight, bishop, queen, king).
- A dude carries a **candidate set** of piece types it might be. When it moves, piece types incompatible with that move are eliminated from its candidate set.
- Once a dude's candidate set collapses to a single type, it is **materialized** (revealed) as that piece and plays as it would in standard chess from then on.
- **Collapse can also be forced indirectly**: if global constraints on the board (e.g., "exactly one king per side") uniquely determine the identity of a remaining dude, it materializes without needing to move.
- **Check interacts with superposition**: an attack on a dude whose candidate set still contains the king flags it as a king-candidate. The player can either leave it as king-candidate (potentially forcing it into king) or make a move incompatible with king to collapse it into a non-king and sidestep the "check" that way.

Illustrative examples from the README:

1. A dude moves A1 → B3: only a knight moves that way, so the dude materializes as a knight.
2. 7 of 8 dudes have materialized as non-kings ⇒ the 8th materializes as king automatically.
3. An opponent attacks a dude in a way that would be check if it were a king ⇒ that dude is now a king-candidate; it can escape by making a non-king move.
4. A dude moves A1 → B2: compatible with bishop, queen, or king ⇒ candidate set narrows to {B, Q, K} but does not yet materialize.

---

## 2. Resolved rules

### 2.1 Candidate sets

Each dude has two conceptual candidate sets:

- **Local candidate set** — the types consistent with the dude's own move history. Shrinks monotonically; a move that restricts it can never be undone.
- **Effective candidate set** — `local ∩ current global constraints`. Recomputed after every ply. Can grow when global constraints relax (see queen rule).

A dude **materializes** into a concrete piece iff its effective candidate set has exactly one element. Materialization is irreversible (the piece is no longer a dude; further captures/moves follow standard chess rules for that piece type).

### 2.2 Global constraints on piece counts

- **Rooks / Knights / Bishops**: no count limit. Any number of dudes on a side may materialize into any of these.
- **Queen**: at most **1 alive at a time**, per side.
  - While a queen exists on the board, queen is removed from every dude's effective candidate set.
  - If the living queen is captured, the queen slot reopens: queen is re-added to the effective candidate set of every dude whose local candidate set still contains queen.
- **King**: exactly **1 per side, always**, either materialized or hidden inside dudes' candidate sets.
  - The invariant "at least one live piece is or could be king" must hold at all times.
  - If only one live dude still has king in its effective candidate set (and no king has materialized), that dude materializes as king immediately (eager propagation).

### 2.3 Move legality

For a proposed move of a dude:

1. Compute the set `M` of piece types that could physically make this move from this square to that destination.
2. Intersect with the dude's effective candidate set: `new_local = effective ∩ M`.
3. If `new_local` is empty → move is illegal.
4. Otherwise → the move is legal; update the dude's local candidate set to `new_local`, apply the move, then re-run global propagation (which may materialize this dude or others and may readmit queen if it was just captured).

### 2.4 Pawn promotion

- A pawn that reaches the back rank promotes into a **new dude**, not a chosen piece.
- The promoted dude's local candidate set is the **widest possible**: `{R, N, B, Q, K}`, subject only to the current global constraints (e.g., if a queen is alive, queen is excluded from its effective set; if a king is already materialized, king is excluded).
- This grows the dude pool over the course of the game, which in turn can make the king-forcing invariant redistribute over more pieces.

### 2.5 Castling

- Castling rules are as in standard chess (both partners have never moved, path is clear, standard king-safety conditions) **with one extension**: the rook partner is not restricted to the corner squares — any dude on the back rank that still has rook in its effective candidate set may be the rook partner.
- The act of castling itself materializes the rook partner into a **rook**.
- If the king partner is still an unmaterialized dude (king-candidate), castling **simultaneously materializes that dude into a king** and the partner into a rook.
- A dude that has moved previously (even if not yet materialized) loses its castling rights, mirroring the standard "rook/king has never moved" condition.

### 2.6 Information visibility

- Materialized pieces are fully public information for both players.
- There are no hidden-information mechanics beyond the shared uncertainty of which dudes will turn into which pieces.
- **UI choice**: intermediate narrowing of candidate sets (e.g., a dude narrowed to `{B, Q, K}`) is *not* visualized. The UI only changes the piece's appearance on final materialization into a single type.

### 2.7 Propagation order (per ply)

After every move:

1. Apply the move and update the moved dude's local candidate set.
2. Re-evaluate global constraints (queen alive? king materialized? count of dudes still eligible to be king?).
3. For every dude, recompute `effective = local ∩ global`.
4. If any dude's effective set is now a singleton, materialize it. Materialization may change the global state (e.g., a newly materialized queen or king), so repeat steps 2–4 until a fixed point is reached.

### 2.8 Check and king-candidate resolution

When an opposing piece attacks a dude whose effective candidate set contains king, the dude becomes a **king-candidate under check**. The attacking side's move ends, and on the next ply of the attacked dude's owner the attack must be resolved (as with check in standard chess).

The resolution rule is:

- The attacked dude **will materialize as king** unless its owner "proves otherwise". The only way to prove otherwise is for **the attacked dude itself** to make a move that is incompatible with king — i.e., a move that eliminates king from its local candidate set (for example, any straight or diagonal move of more than one square, or a knight-shaped move). Doing so sheds king-candidacy and resolves the attack because the dude is now known not to be the king.
- Any other legal resolution of the attack — blocking with another piece, capturing the attacker with another piece, or moving the attacked dude one square to safety (consistent with king) — does not contradict the attacked dude being a king. As a side-effect of such a resolution, the attacked dude **materializes as king**.
- If no legal resolution exists, the position is **checkmate** (see 2.9).

Once a king has materialized, standard chess king rules apply from that point on: the king cannot move into check, cannot be captured, and any move that would leave the king in check is illegal.

### 2.9 Win condition

- A side loses when its **materialized king** is checkmated in the classical sense: the king is in check and no legal move resolves it.
- If global propagation would force a dude to materialize as king into a position that is already checkmate, that side loses immediately upon that materialization.
