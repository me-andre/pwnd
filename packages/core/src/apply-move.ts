import { assertKingInvariant, effectiveCandidates, propagate, sideHasKing } from "./candidates.js";
import {
  bishopReachable,
  dudeKindsForMove,
  dudeReachable,
  kingReachable,
  knightReachable,
  pawnReachable,
  queenReachable,
  rookReachable,
  squaresBetween,
} from "./movement.js";
import { rankOf } from "./squares.js";
import type {
  CastlingRights,
  Cell,
  DudeKind,
  GameState,
  Move,
  ReplayedMove,
  Side,
} from "./types.js";

// ── Board query helpers ───────────────────────────────────────────────────────

function isOccupied(board: ReadonlyArray<Cell>, sq: number): boolean {
  const cell = board[sq];
  if (cell === undefined) return false;
  return cell !== null;
}

function isFriendly(board: ReadonlyArray<Cell>, side: Side, sq: number): boolean {
  const cell = board[sq];
  if (cell === undefined) return false;
  return cell !== null && cell.owner === side;
}

function isEnemy(board: ReadonlyArray<Cell>, side: Side, sq: number): boolean {
  const cell = board[sq];
  if (cell === undefined) return false;
  return cell !== null && cell.owner !== side;
}

// ── Candidate-move generation (§2.3 step 1, §2.5) ─────────────────────────────

/**
 * §2.3 step 1: enumerate the moves the piece / dude at `from` could physically
 * make (the geometry, plus §2.5 castling). Does NOT apply the §2.3/§2.8
 * legality filter — use `getLegalMoves` / `isMoveAllowed` for that.
 */
export function getCandidateMoves(state: GameState, from: number): Move[] {
  const cell = state.board[from];
  if (cell === undefined || cell === null) return [];

  const side = cell.owner;
  const { board } = state;
  const occupied = (sq: number) => isOccupied(board, sq);
  const friendly = (sq: number) => isFriendly(board, side, sq);
  const enemy = (sq: number) => isEnemy(board, side, sq);

  const moves: Move[] = [];

  if (cell.kind === "materialized") {
    switch (cell.piece) {
      case "P": {
        const dests = pawnReachable(from, side, occupied, enemy, state.enPassantTarget);
        for (const to of dests) {
          const destRank = rankOf(to);
          const promotionRank = side === "white" ? 7 : 0;
          if (destRank === promotionRank) {
            moves.push({ kind: "promotion", from, to });
          } else if (to === state.enPassantTarget) {
            const dr = side === "white" ? -1 : 1;
            const capturedPawnSquare = to + dr * 8;
            moves.push({ kind: "en-passant", from, to, capturedPawnSquare });
          } else {
            moves.push({ kind: "normal", from, to });
          }
        }
        break;
      }
      case "K": {
        const dests = kingReachable(from, occupied, friendly);
        for (const to of dests) moves.push({ kind: "normal", from, to });
        const castlingMoves = getCastlingMoves(state, from, side);
        moves.push(...castlingMoves);
        break;
      }
      case "R": {
        const dests = rookReachable(from, occupied, friendly);
        for (const to of dests) moves.push({ kind: "normal", from, to });
        break;
      }
      case "N": {
        const dests = knightReachable(from, occupied, friendly);
        for (const to of dests) moves.push({ kind: "normal", from, to });
        break;
      }
      case "B": {
        const dests = bishopReachable(from, occupied, friendly);
        for (const to of dests) moves.push({ kind: "normal", from, to });
        break;
      }
      case "Q": {
        const dests = queenReachable(from, occupied, friendly);
        for (const to of dests) moves.push({ kind: "normal", from, to });
        break;
      }
    }
  } else {
    // Dude
    const eff = effectiveCandidates(cell.localCandidates, state.board, side);
    const dests = dudeReachable(from, eff, occupied, friendly);
    for (const to of dests) {
      moves.push({ kind: "normal", from, to });
    }
    // Castling: dude with K in effective set may castle as the king
    if (eff.includes("K")) {
      const castlingMoves = getCastlingMoves(state, from, side);
      moves.push(...castlingMoves);
    }
  }

  return moves;
}

/** §2.5: castling candidates — any back-rank dude/rook with R as partner. */
export function getCastlingMoves(state: GameState, kingFrom: number, side: Side): Move[] {
  const moves: Move[] = [];
  const backRank = side === "white" ? 0 : 7;

  if (rankOf(kingFrom) !== backRank) return moves;

  const rights = state.castlingRights;
  const kingSide = side === "white" ? rights.whiteKingSide : rights.blackKingSide;
  const queenSide = side === "white" ? rights.whiteQueenSide : rights.blackQueenSide;

  if (kingSide) {
    const rookFrom = backRank * 8 + 7;
    const kingTo = backRank * 8 + 6;
    const rookTo = backRank * 8 + 5;
    if (rookFrom !== kingFrom && isValidCastlingPartner(state, rookFrom, side)) {
      const path = squaresBetween(kingFrom, rookFrom);
      if (path.every((sq) => state.board[sq] === null)) {
        moves.push({ kind: "castling", from: kingFrom, to: kingTo, rookFrom, rookTo });
      }
    }
  }

  if (queenSide) {
    const rookFrom = backRank * 8 + 0;
    const kingTo = backRank * 8 + 2;
    const rookTo = backRank * 8 + 3;
    if (rookFrom !== kingFrom && isValidCastlingPartner(state, rookFrom, side)) {
      const path = squaresBetween(kingFrom, rookFrom);
      if (path.every((sq) => state.board[sq] === null)) {
        moves.push({ kind: "castling", from: kingFrom, to: kingTo, rookFrom, rookTo });
      }
    }
  }

  return moves;
}

/** §2.5: a castling partner is any back-rank cell that still could be a rook. */
function isValidCastlingPartner(state: GameState, sq: number, side: Side): boolean {
  const cell = state.board[sq];
  if (cell === undefined || cell === null || cell.owner !== side) return false;
  if (cell.kind === "materialized") return cell.piece === "R";
  const eff = effectiveCandidates(cell.localCandidates, state.board, side);
  return eff.includes("R");
}

// ── Check detection (§2.8) ────────────────────────────────────────────────────

/** §2.8: a materialized king attacked is check, the classic case. */
export function isInCheck(state: GameState, side: Side): boolean {
  const kingSquare = findMaterializedKing(state.board, side);
  if (kingSquare === null) return false;
  return isSquareAttackedBy(state, kingSquare, side === "white" ? "black" : "white");
}

export function findMaterializedKing(board: ReadonlyArray<Cell>, side: Side): number | null {
  for (let i = 0; i < 64; i++) {
    const cell = board[i];
    if (cell === undefined || cell === null) continue;
    if (cell.kind === "materialized" && cell.owner === side && cell.piece === "K") {
      return i;
    }
  }
  return null;
}

/**
 * Returns true if `square` is attacked by any piece belonging to
 * `attackingSide`. Uses candidate moves (without legality filtering to avoid
 * infinite recursion).
 */
export function isSquareAttackedBy(state: GameState, square: number, attackingSide: Side): boolean {
  const { board } = state;
  for (let i = 0; i < 64; i++) {
    const cell = board[i];
    if (cell === undefined || cell === null || cell.owner !== attackingSide) continue;
    const candidates = getCandidateMoves(state, i);
    if (candidates.some((m) => m.to === square)) return true;
  }
  return false;
}

/**
 * All squares holding a dude of `side` that still has K in its effective
 * candidate set AND is attacked by the opponent — i.e. every "king-candidate
 * under check". A single attacker can fork several of them at once.
 */
export function attackedKingCandidates(state: GameState, side: Side): number[] {
  const attackingSide: Side = side === "white" ? "black" : "white";
  const result: number[] = [];
  for (let i = 0; i < 64; i++) {
    const cell = state.board[i];
    if (cell === undefined || cell === null || cell.kind !== "dude" || cell.owner !== side) {
      continue;
    }
    const eff = effectiveCandidates(cell.localCandidates, state.board, side);
    if (!eff.includes("K")) continue;
    if (isSquareAttackedBy(state, i, attackingSide)) result.push(i);
  }
  return result;
}

/** First attacked king-candidate square, or null (back-compat / UI helper). */
export function findKingCandidateUnderAttack(state: GameState, side: Side): number | null {
  return attackedKingCandidates(state, side)[0] ?? null;
}

/**
 * Generalized check test. A side is in check if its materialized king is
 * attacked, or if any of its dudes that could still be the king is attacked
 * (any such dude might BE the king, so leaving one attacked leaves the king in
 * check). This is the single legality rule for the king-candidate mechanic.
 */
export function sideInCheck(state: GameState, side: Side): boolean {
  if (isInCheck(state, side)) return true;
  return attackedKingCandidates(state, side).length > 0;
}

// ── §2.8 active under-attack narrowing ("a king cannot move into check") ──────

/**
 * A king may never move to a square attacked by the opponent (the opponent
 * could capture it on the next move). Therefore, when a dude voluntarily moves
 * to a square that is attacked in the resulting position, it proves it is NOT
 * the king and K is eliminated from its candidate set.
 *
 * Returns true if, after vacating `from` and placing `mover` on `to`, the
 * square `to` is attacked by the opposing side.
 */
function destinationAttackedAfterMove({
  board,
  from,
  to,
  mover,
  side,
  enPassantTarget,
}: {
  board: ReadonlyArray<Cell>;
  from: number;
  to: number;
  mover: Cell;
  side: Side;
  enPassantTarget: number | null;
}): boolean {
  const sim = [...board] as Cell[];
  sim[from] = null;
  sim[to] = mover;
  const attackingSide: Side = side === "white" ? "black" : "white";
  const probe: GameState = {
    board: sim,
    turnNumber: 0,
    moveLog: [],
    // Castling rights are irrelevant to raw attack detection and, left enabled,
    // would spuriously count castling target squares as "attacked".
    castlingRights: {
      whiteKingSide: false,
      whiteQueenSide: false,
      blackKingSide: false,
      blackQueenSide: false,
    },
    result: { status: "ongoing" },
    enPassantTarget,
  };
  return isSquareAttackedBy(probe, to, attackingSide);
}

/**
 * Narrow a dude's candidate set for the move `from → to`:
 *   1. Intersect `candidates` with the move geometry.
 *   2. Remove K if the destination is attacked (a king cannot move into check).
 * Returns the narrowed set; an empty result means the move is illegal.
 */
function narrowDudeMove({
  board,
  from,
  to,
  mover,
  candidates,
  side,
  enPassantTarget,
}: {
  board: ReadonlyArray<Cell>;
  from: number;
  to: number;
  mover: Cell;
  candidates: ReadonlyArray<DudeKind>;
  side: Side;
  enPassantTarget: number | null;
}): DudeKind[] {
  const geometry = dudeKindsForMove(from, to);
  let narrowed = candidates.filter((k) => geometry.includes(k));
  if (
    narrowed.includes("K") &&
    destinationAttackedAfterMove({ board, from, to, mover, side, enPassantTarget })
  ) {
    narrowed = narrowed.filter((k) => k !== "K");
  }
  return narrowed;
}

// ── §2.8 check resolution (passive shed + forced fork-crown) ──────────────────

/**
 * Passive "under-attack" narrowing. Symmetric to the active rule (a dude that
 * MOVES onto an attacked square sheds K): a dude-with-K that is left under
 * attack by *this* move without having moved — e.g. unshielded by moving away
 * its blocker, or exposed via a discovered attack — also sheds K. Choosing to
 * expose it declares it is not the king.
 *
 * Only dudes that are *newly* attacked are shed (square not attacked before the
 * move). A standing attack — one present before the move — is a real check that
 * must be actively resolved, not silently dismissed. The moved dude is excluded
 * (its own square is handled by active narrowing).
 *
 * Note: an un-materialized dude always has at least one non-K effective
 * candidate (a singleton {K} would already have materialized), so shedding K
 * never empties a single dude. Exposing *every* king-carrier at once is caught
 * separately by the king-presence legality gate.
 */
function shedUnshieldedKingCandidates(
  state: GameState,
  board: ReadonlyArray<Cell>,
  side: Side,
  beforeAttacked: ReadonlySet<number>,
  movedTo: number,
): { board: ReadonlyArray<Cell>; materializedSquares: number[] } {
  const attackingSide: Side = side === "white" ? "black" : "white";
  const probe: GameState = { ...state, board };
  const toShed: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (i === movedTo || beforeAttacked.has(i)) continue;
    const cell = board[i];
    if (cell === undefined || cell === null || cell.kind !== "dude" || cell.owner !== side) {
      continue;
    }
    if (!effectiveCandidates(cell.localCandidates, board, side).includes("K")) continue;
    if (!isSquareAttackedBy(probe, i, attackingSide)) continue;
    toShed.push(i);
  }

  if (toShed.length === 0) return { board, materializedSquares: [] };

  const newBoard = [...board] as Cell[];
  for (const i of toShed) {
    const cell = newBoard[i];
    if (cell === undefined || cell === null || cell.kind !== "dude") continue;
    newBoard[i] = { ...cell, localCandidates: cell.localCandidates.filter((k) => k !== "K") };
  }
  const { board: cascaded, materializedSquares } = propagate(newBoard);
  return { board: cascaded, materializedSquares };
}

/**
 * The single forced collapse of the king-candidate mechanic.
 *
 * Blocking, capturing the attacker, or a king-ish evasion do NOT, on their own,
 * reveal a dude as the king — being shielded/captured-for is something any
 * piece allows, and a one-square move is something a rook/bishop/queen could
 * also make. Such resolutions leave the dudes in superposition.
 *
 * The exception: if a dude that was under attack EVADES in a king-ish manner
 * (it moved and kept K — so it now sits safe; under-attack narrowing guarantees a
 * dude that kept K is on a safe square), and OTHER dudes-with-K are still left
 * under attack, then the evader is forced to become the king. Becoming the king
 * strips K from every friendly dude, which dissolves the remaining checks (the
 * forked siblings are no longer king-candidates).
 *
 * `beforeAttacked` — squares that were attacked king-candidates BEFORE the move.
 * Returns the (possibly updated) board plus any newly materialized squares.
 */
function resolveForkCrown(
  state: GameState,
  board: ReadonlyArray<Cell>,
  side: Side,
  beforeAttacked: ReadonlySet<number>,
  moveFrom: number,
  moveTo: number,
): { board: ReadonlyArray<Cell>; materializedSquares: number[] } {
  // Only the dude that itself evaded can be force-crowned.
  if (!beforeAttacked.has(moveFrom)) return { board, materializedSquares: [] };

  const evader = board[moveTo];
  // The evader must still be an undecided king-candidate (kept K through the
  // move). If it shed K or already materialized, there is nothing to force.
  if (evader === undefined || evader === null || evader.kind !== "dude") {
    return { board, materializedSquares: [] };
  }
  if (!effectiveCandidates(evader.localCandidates, board, side).includes("K")) {
    return { board, materializedSquares: [] };
  }

  // Force only when other king-candidates remain under attack.
  const stillAttacked = attackedKingCandidates({ ...state, board }, side).filter(
    (sq) => sq !== moveTo,
  );
  if (stillAttacked.length === 0) return { board, materializedSquares: [] };

  const newBoard = [...board] as Cell[];
  newBoard[moveTo] = { kind: "materialized", owner: side, piece: "K" };
  const { board: cascaded, materializedSquares } = propagate(newBoard);
  return { board: cascaded, materializedSquares: [moveTo, ...materializedSquares] };
}

// ── Geometry: the one board edit (§2.3 apply, §2.5 castling) ──────────────────

/**
 * Apply a move's board edits and return the resulting board (pre-propagation).
 * The single source of truth for "where pieces land":
 *   - normal: move the occupant; a dude narrows its candidate set (§2.3 step 4,
 *     incl. the §2.8 active "moved onto attacked square sheds K" narrowing).
 *   - promotion: the moved pawn becomes a fresh widest-set dude (§2.4).
 *   - castling: king-dude materializes as K and the partner as R (§2.5).
 *   - en-passant: the captured pawn is removed and the pawn lands on `to`.
 *
 * Pure: never mutates the input board.
 */
function applyMoveGeometry({
  board,
  move,
  side,
  enPassantTarget,
}: {
  board: ReadonlyArray<Cell>;
  move: Move;
  side: Side;
  enPassantTarget: number | null;
}): Cell[] {
  const newBoard = [...board] as Cell[];

  if (move.kind === "castling") {
    const kingCell = newBoard[move.from];
    newBoard[move.from] = null;
    newBoard[move.to] =
      kingCell !== undefined && kingCell !== null && kingCell.kind === "dude"
        ? { kind: "materialized", owner: side, piece: "K" }
        : (kingCell ?? null);
    newBoard[move.rookFrom!] = null;
    newBoard[move.rookTo!] = { kind: "materialized", owner: side, piece: "R" };
    return newBoard;
  }

  if (move.kind === "en-passant") {
    const mover = newBoard[move.from] ?? null;
    newBoard[move.from] = null;
    newBoard[move.capturedPawnSquare!] = null;
    newBoard[move.to] = mover;
    return newBoard;
  }

  const mover = newBoard[move.from];
  newBoard[move.from] = null;

  if (move.kind === "promotion") {
    newBoard[move.to] = { kind: "dude", owner: side, localCandidates: ["R", "N", "B", "Q", "K"] };
  } else if (mover !== undefined && mover !== null && mover.kind === "dude") {
    const eff = effectiveCandidates(mover.localCandidates, board, side);
    const narrowed = narrowDudeMove({
      board,
      from: move.from,
      to: move.to,
      mover,
      candidates: eff,
      side,
      enPassantTarget,
    });
    newBoard[move.to] = { ...mover, localCandidates: narrowed };
  } else {
    newBoard[move.to] = mover ?? null;
  }

  return newBoard;
}

// ── Superposition resolution (§2.7 propagate → §2.8 shed → §2.8 fork-crown) ───

/**
 * Run the full per-ply resolution on a post-geometry board:
 *   1. §2.7 global propagation (singleton / king-eager materialization).
 *   2. §2.8 passive under-attack narrowing (newly exposed dudes shed K).
 *   3. §2.8 forced fork-crown (a king-ish evader becomes the king when other
 *      king-candidates remain under attack).
 * Returns the resolved board and every square materialized along the way.
 */
function resolveSuperposition({
  state,
  board,
  side,
  beforeAttacked,
  move,
}: {
  state: GameState;
  board: ReadonlyArray<Cell>;
  side: Side;
  beforeAttacked: ReadonlySet<number>;
  move: Move;
}): { board: ReadonlyArray<Cell>; materializedSquares: number[] } {
  const { board: propagatedBoard, materializedSquares } = propagate(board);
  const shed = shedUnshieldedKingCandidates(state, propagatedBoard, side, beforeAttacked, move.to);
  const resolved = resolveForkCrown(state, shed.board, side, beforeAttacked, move.from, move.to);
  return {
    board: resolved.board,
    materializedSquares: [
      ...materializedSquares,
      ...shed.materializedSquares,
      ...resolved.materializedSquares,
    ],
  };
}

/**
 * The shared "apply then resolve" pipeline: §2.3 board edit followed by the
 * §2.7/§2.8 resolution. Used by both `isMoveAllowed` (legality) and `applyMove`
 * (the accepted result) so the two can never diverge.
 */
function simulateMove({
  state,
  move,
  side,
  beforeAttacked,
}: {
  state: GameState;
  move: Move;
  side: Side;
  beforeAttacked: ReadonlySet<number>;
}): { board: ReadonlyArray<Cell>; materializedSquares: number[] } {
  const board = applyMoveGeometry({
    board: state.board,
    move,
    side,
    enPassantTarget: state.enPassantTarget,
  });
  return resolveSuperposition({ state, board, side, beforeAttacked, move });
}

// ── §2.x legality predicates ──────────────────────────────────────────────────

/**
 * §2.3 step 3: a dude's move must keep at least one candidate. Intersecting the
 * effective set with the move geometry (and shedding K when the destination is
 * attacked) must leave a non-empty set. Non-dude moves and non-normal moves
 * carry no such constraint.
 */
function moveNarrowsToSomeCandidate({
  state,
  move,
  side,
}: {
  state: GameState;
  move: Move;
  side: Side;
}): boolean {
  const cell = state.board[move.from];
  if (cell === undefined || cell === null) return false;
  if (cell.kind !== "dude" || move.kind !== "normal") return true;
  const eff = effectiveCandidates(cell.localCandidates, state.board, side);
  const narrowed = narrowDudeMove({
    board: state.board,
    from: move.from,
    to: move.to,
    mover: cell,
    candidates: eff,
    side,
    enPassantTarget: state.enPassantTarget,
  });
  return narrowed.length > 0;
}

/**
 * §2.5 king-safety: the castling king may not start in, pass through, or land
 * on an attacked square. Evaluated against the pre-move board.
 */
function castlingPathClearOfCheck({
  state,
  move,
  side,
}: {
  state: GameState;
  move: Move;
  side: Side;
}): boolean {
  const attackingSide: Side = side === "white" ? "black" : "white";
  const passThrough = squaresBetween(move.from, move.to);
  for (const sq of [move.from, ...passThrough, move.to]) {
    if (isSquareAttackedBy(state, sq, attackingSide)) return false;
  }
  return true;
}

/**
 * §2.2/§2.8 king-presence gate: a move may not leave the side with no possible
 * king. Delegates to `sideHasKing` (materialized king or a dude that still
 * carries K).
 */
function willLeaveAtLeastOneKing({
  board,
  side,
}: {
  board: ReadonlyArray<Cell>;
  side: Side;
}): boolean {
  return sideHasKing(board, side);
}

/**
 * The declarative legality rule, one step per §2.x:
 *   §2.3 the dude's move must narrow to some candidate.
 *   §2.5 castling must not cross an attacked square.
 *   §2.8 after resolving, no king-carrier may be left under attack.
 *   §2.2/§2.8 a king must remain on the side.
 */
function isMoveAllowed({
  state,
  move,
  side,
  beforeAttacked,
}: {
  state: GameState;
  move: Move;
  side: Side;
  beforeAttacked: ReadonlySet<number>;
}): boolean {
  if (!moveNarrowsToSomeCandidate({ state, move, side })) return false; // §2.3
  if (move.kind === "castling" && !castlingPathClearOfCheck({ state, move, side })) {
    return false; // §2.5
  }
  const { board } = simulateMove({ state, move, side, beforeAttacked }); // §2.3 + §2.7 + §2.8
  const next: GameState = { ...state, board, turnNumber: state.turnNumber + 1 };
  if (sideInCheck(next, side)) return false; // §2.8: no king-carrier left under attack
  if (!willLeaveAtLeastOneKing({ board, side })) return false; // §2.2/§2.8: a king must remain
  return true;
}

// ── Apply move ────────────────────────────────────────────────────────────────

export type ApplyMoveResult = {
  nextState: GameState;
  accepted: boolean;
  reason?: string;
  replayedMove: ReplayedMove;
};

export function applyMove(state: GameState, move: Move): ApplyMoveResult {
  if (state.result.status !== "ongoing") {
    return reject(state, move, "Game is over");
  }

  const { board } = state;
  const side: Side = state.turnNumber % 2 === 0 ? "white" : "black";
  const cell = board[move.from];

  if (cell === undefined || cell === null) return reject(state, move, "No piece at source");
  if (cell.owner !== side) return reject(state, move, "Not your piece");

  // Snapshot which king-candidates are under attack before the move, so the
  // fork-crown rule can fire inside the shared simulation.
  const beforeAttacked = new Set(attackedKingCandidates(state, side));

  if (!isMoveAllowed({ state, move, side, beforeAttacked })) {
    return reject(state, move, "Illegal move");
  }

  // Build the accepted result from the SAME pipeline legality used.
  const { board: finalBoard, materializedSquares } = simulateMove({
    state,
    move,
    side,
    beforeAttacked,
  });

  // Metadata folds uniformly: castling revokes the side's rights; everything
  // else runs the corner/king tracking. `computeEnPassant` yields null for
  // castling and en-passant, so both share the normal path.
  const newCastlingRights =
    move.kind === "castling"
      ? revokeCastlingForSide(state.castlingRights, side)
      : updateCastlingRights(state.castlingRights, move, cell, side);
  const newEnPassant = computeEnPassant(move, cell);

  const newState: GameState = {
    board: finalBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: newCastlingRights,
    result: { status: "ongoing" },
    enPassantTarget: newEnPassant,
  };

  // Guard the core invariant: the accepted state must keep a king alive.
  assertKingInvariant(newState.board);

  const opponent: Side = side === "white" ? "black" : "white";
  const finalState = computeResult(newState, opponent);

  return {
    nextState: finalState,
    accepted: true,
    replayedMove: { status: "accepted", move, materializedSquares },
  };
}

function reject(state: GameState, move: Move, reason: string): ApplyMoveResult {
  return {
    nextState: state,
    accepted: false,
    reason,
    replayedMove: { status: "rejected", move, materializedSquares: [] },
  };
}

// ── Legal moves (§2.3/§2.5/§2.8 filtered candidates) ──────────────────────────

export function getLegalMoves(state: GameState, from: number): Move[] {
  const cell = state.board[from];
  if (cell === undefined || cell === null) return [];

  const side = cell.owner;
  // Snapshot which king-candidates are under attack before the move, so the
  // fork-crown rule can be applied inside the simulation.
  const beforeAttacked = new Set(attackedKingCandidates(state, side));

  return getCandidateMoves(state, from).filter((move) =>
    isMoveAllowed({ state, move, side, beforeAttacked }),
  );
}

// ── Castling rights ───────────────────────────────────────────────────────────

function updateCastlingRights(
  rights: CastlingRights,
  move: Move,
  movedCell: Cell,
  side: Side,
): CastlingRights {
  let r = { ...rights };

  if (movedCell !== null && movedCell.kind === "materialized" && movedCell.piece === "K") {
    r = revokeCastlingForSide(r, side);
  }
  if (move.from === 0) r = { ...r, whiteQueenSide: false };
  if (move.from === 7) r = { ...r, whiteKingSide: false };
  if (move.from === 56) r = { ...r, blackQueenSide: false };
  if (move.from === 63) r = { ...r, blackKingSide: false };

  if (move.to === 0) r = { ...r, whiteQueenSide: false };
  if (move.to === 7) r = { ...r, whiteKingSide: false };
  if (move.to === 56) r = { ...r, blackQueenSide: false };
  if (move.to === 63) r = { ...r, blackKingSide: false };

  return r;
}

function revokeCastlingForSide(rights: CastlingRights, side: Side): CastlingRights {
  if (side === "white") {
    return { ...rights, whiteKingSide: false, whiteQueenSide: false };
  }
  return { ...rights, blackKingSide: false, blackQueenSide: false };
}

function computeEnPassant(move: Move, cell: Cell): number | null {
  if (
    cell !== null &&
    cell.kind === "materialized" &&
    cell.piece === "P" &&
    move.kind === "normal"
  ) {
    const dr = rankOf(move.to) - rankOf(move.from);
    if (Math.abs(dr) === 2) {
      return move.from + (dr > 0 ? 8 : -8);
    }
  }
  return null;
}

// ── Game result ───────────────────────────────────────────────────────────────

function computeResult(state: GameState, sideToCheck: Side): GameState {
  if (isCheckmate(state, sideToCheck)) {
    const winner: Side = sideToCheck === "white" ? "black" : "white";
    return { ...state, result: { status: "win", winner } };
  }
  return state;
}

export function isCheckmate(state: GameState, side: Side): boolean {
  if (!sideInCheck(state, side)) return false;

  for (let i = 0; i < 64; i++) {
    const cell = state.board[i];
    if (cell === undefined || cell === null || cell.owner !== side) continue;
    const legal = getLegalMoves(state, i);
    if (legal.length > 0) return false;
  }

  return true;
}

export function isGameOver(state: GameState): boolean {
  return state.result.status !== "ongoing";
}

export function whoseTurn(state: GameState): Side {
  return state.turnNumber % 2 === 0 ? "white" : "black";
}

export function getPossibleMovesForFigure(state: GameState, from: number): Move[] {
  return getLegalMoves(state, from);
}
