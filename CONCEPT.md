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

When an opposing piece attacks a dude whose effective candidate set contains king, that dude is a **king-candidate under check** — it might *be* the king, so the position is not allowed to leave it under attack. A single attacker may fork several king-candidates at once.

The governing rule is a single legality constraint:

- **A move is permitted unless it leaves a dude that still carries king (or a materialized king) under attack.** Standard check on a materialized king is just the case where the side has already collapsed to a real king.

So a check on king-candidate(s) must be resolved by a move that ends with *no* king-carrying dude attacked. The usual options are: capture the attacker, block the line with another piece, or move an attacked dude to safety. If no such move exists, the position is **checkmate** (see 2.9).

Resolving a check generally does **not** reveal the king — superposition is preserved:

- **Capturing the attacker** with any piece leaves the threatened dudes as undecided king-candidates.
- **Blocking** with another piece does not reveal the king (any piece can be shielded). It only collapses indirectly: e.g. a blocker that steps onto the attacked line sheds its own king (under-attack narrowing, below), which can leave a sibling as the *sole* king-candidate that king-eager then materializes.
- **A king-ish evasion** — moving an attacked dude one square to safety — does not by itself reveal the king, because a rook/bishop/queen could have made the same step. It collapses to king only when ordinary geometry leaves king as the **sole** matching candidate.

**Under-attack narrowing.** A king may not stand on an attacked square, so a dude that ends a move under attack sheds king — declaring it is not the king. This happens two ways:

- *Actively*, when a dude **moves onto** an attacked square.
- *Passively*, when **this** move newly exposes a dude to attack without it moving — e.g. by moving away its shield (a discovered/unshielded attack).

Only *newly created* attacks shed king this way. A **standing check** — an attack already present at the start of the turn — is not silently dismissed; it must be actively resolved. And you may not expose every king-carrier at once: a move that would leave the side with no possible king is illegal.

There is exactly **one forced materialization** specific to check resolution:

- If a dude that was under attack **evades king-ishly** (it moved, kept king, and now sits safe) while **other** king-carrying dudes are *still left under attack*, that evader is **forced to become the king**. Becoming the king strips king from every friendly dude, which dissolves the siblings' checks (they are no longer king-candidates). This is the move that resolves a fork by declaring "the one that escaped is the king".

Once a king has materialized, standard chess king rules apply from that point on: the king cannot move into check, cannot be captured, and any move that would leave the king in check is illegal.

### 2.9 Win condition

- A side loses when its **materialized king** is checkmated in the classical sense: the king is in check and no legal move resolves it.
- If global propagation would force a dude to materialize as king into a position that is already checkmate, that side loses immediately upon that materialization.
