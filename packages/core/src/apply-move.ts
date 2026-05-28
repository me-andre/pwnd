import { assertKingInvariant, effectiveCandidates, propagate } from "./candidates.js";
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

// ── Legal-move generation ─────────────────────────────────────────────────────

/**
 * Return all candidate destination squares for the piece / dude at `from`.
 * Does NOT filter moves that leave the mover's king in check — use
 * `getLegalMoves` for that.
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

function isValidCastlingPartner(state: GameState, sq: number, side: Side): boolean {
  const cell = state.board[sq];
  if (cell === undefined || cell === null || cell.owner !== side) return false;
  if (cell.kind === "materialized") return cell.piece === "R";
  const eff = effectiveCandidates(cell.localCandidates, state.board, side);
  return eff.includes("R");
}

// ── Check detection ───────────────────────────────────────────────────────────

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

// ── "King cannot move into check" narrowing ───────────────────────────────────

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

// ── King-candidate check resolution ──────────────────────────────────────────

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

  // Snapshot which king-candidates are under attack before the move.
  const beforeAttacked = new Set(attackedKingCandidates(state, side));

  const legalMoves = getLegalMoves(state, move.from);
  const isLegal = legalMoves.some(
    (m) =>
      m.from === move.from &&
      m.to === move.to &&
      m.kind === move.kind &&
      m.rookFrom === move.rookFrom,
  );
  if (!isLegal) return reject(state, move, "Illegal move");

  if (move.kind === "castling") {
    return executeCastling(state, move, side, beforeAttacked);
  }
  if (move.kind === "en-passant") {
    return executeEnPassant(state, move, side, beforeAttacked);
  }

  const newBoard = [...board] as Cell[];
  const mover = newBoard[move.from]!;
  newBoard[move.from] = null;

  if (move.kind === "promotion") {
    newBoard[move.to] = {
      kind: "dude",
      owner: side,
      localCandidates: ["R", "N", "B", "Q", "K"],
    };
  } else if (mover.kind === "dude") {
    const eff = effectiveCandidates(mover.localCandidates, board, side);
    const narrowed = narrowDudeMove({
      board,
      from: move.from,
      to: move.to,
      mover,
      candidates: eff,
      side,
      enPassantTarget: state.enPassantTarget,
    });
    if (narrowed.length === 0) return reject(state, move, "Move incompatible with all candidates");
    newBoard[move.to] = { ...mover, localCandidates: narrowed };
  } else {
    newBoard[move.to] = mover;
  }

  const newCastlingRights = updateCastlingRights(state.castlingRights, move, cell, side);
  const newEnPassant = computeEnPassant(move, cell);
  const { board: propagatedBoard, materializedSquares } = propagate(newBoard);

  // Forced collapse: an attacked dude that evaded king-ishly becomes the king
  // when other king-candidates remain under attack (resolving them).
  const resolved = resolveForkCrown(
    state,
    propagatedBoard,
    side,
    beforeAttacked,
    move.from,
    move.to,
  );
  const finalBoard = resolved.board;
  const allMaterialized = [...materializedSquares, ...resolved.materializedSquares];

  const newState: GameState = {
    board: finalBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: newCastlingRights,
    result: { status: "ongoing" },
    enPassantTarget: newEnPassant,
  };

  if (sideInCheck(newState, side)) {
    return reject(state, move, "Move leaves a king-candidate under check");
  }

  // Guard the core invariant: the accepted state must keep a king alive.
  assertKingInvariant(newState.board);

  const opponent: Side = side === "white" ? "black" : "white";
  const finalState = computeResult(newState, opponent);

  return {
    nextState: finalState,
    accepted: true,
    replayedMove: { status: "accepted", move, materializedSquares: allMaterialized },
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

function executeCastling(
  state: GameState,
  move: Move,
  side: Side,
  beforeAttacked: ReadonlySet<number>,
): ApplyMoveResult {
  const rookFrom = move.rookFrom!;
  const rookTo = move.rookTo!;
  const newBoard = [...state.board] as Cell[];

  const kingCell = newBoard[move.from]!;
  newBoard[move.from] = null;
  newBoard[move.to] =
    kingCell.kind === "dude" ? { kind: "materialized", owner: side, piece: "K" } : kingCell;

  newBoard[rookFrom] = null;
  newBoard[rookTo] = { kind: "materialized", owner: side, piece: "R" };

  const newCastlingRights = revokeCastlingForSide(state.castlingRights, side);
  const { board: propagatedBoard, materializedSquares } = propagate(newBoard);

  // Castling materializes the king-dude as king directly; the fork-crown rule
  // applies if any other dude was left attacked (the king now strips their K).
  const resolved = resolveForkCrown(
    state,
    propagatedBoard,
    side,
    beforeAttacked,
    move.from,
    move.to,
  );
  const finalBoard = resolved.board;
  const allMaterialized = [...materializedSquares, ...resolved.materializedSquares];

  const newState: GameState = {
    board: finalBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: newCastlingRights,
    result: { status: "ongoing" },
    enPassantTarget: null,
  };

  if (sideInCheck(newState, side)) {
    return reject(state, move, "Castling into check");
  }

  // Guard the core invariant: the accepted state must keep a king alive.
  assertKingInvariant(newState.board);

  const opponent: Side = side === "white" ? "black" : "white";
  const finalState = computeResult(newState, opponent);

  return {
    nextState: finalState,
    accepted: true,
    replayedMove: { status: "accepted", move, materializedSquares: allMaterialized },
  };
}

function executeEnPassant(
  state: GameState,
  move: Move,
  side: Side,
  beforeAttacked: ReadonlySet<number>,
): ApplyMoveResult {
  const capturedPawnSquare = move.capturedPawnSquare!;
  const newBoard = [...state.board] as Cell[];
  const mover = state.board[move.from] ?? null;
  newBoard[move.from] = null;
  newBoard[capturedPawnSquare] = null;
  newBoard[move.to] = mover;

  const { board: propagatedBoard, materializedSquares } = propagate(newBoard);

  // A pawn making the en-passant capture is never a king-candidate, so this
  // only matters if the capture removed the attacker of a forked dude.
  const resolved = resolveForkCrown(
    state,
    propagatedBoard,
    side,
    beforeAttacked,
    move.from,
    move.to,
  );
  const finalBoard = resolved.board;
  const allMaterialized = [...materializedSquares, ...resolved.materializedSquares];

  const newState: GameState = {
    board: finalBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: state.castlingRights,
    result: { status: "ongoing" },
    enPassantTarget: null,
  };

  if (sideInCheck(newState, side)) {
    return reject(state, move, "Move leaves a king-candidate under check");
  }

  // Guard the core invariant: the accepted state must keep a king alive.
  assertKingInvariant(newState.board);

  const opponent: Side = side === "white" ? "black" : "white";
  const finalState = computeResult(newState, opponent);

  return {
    nextState: finalState,
    accepted: true,
    replayedMove: { status: "accepted", move, materializedSquares: allMaterialized },
  };
}

// ── Legal moves (checking for self-check) ─────────────────────────────────────

export function getLegalMoves(state: GameState, from: number): Move[] {
  const cell = state.board[from];
  if (cell === undefined || cell === null) return [];

  const side = cell.owner;
  // Snapshot which king-candidates are under attack before the move, so the
  // fork-crown rule can be applied inside the simulation.
  const beforeAttacked = new Set(attackedKingCandidates(state, side));

  const candidates = getCandidateMoves(state, from);
  return candidates.filter((move) => {
    // A dude that could only be a king cannot move into an attacked square. If
    // narrowing eliminates every candidate, the move is outright illegal.
    if (cell.kind === "dude" && move.kind === "normal") {
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
      if (narrowed.length === 0) return false;
    }

    const simBoard = [...state.board] as Cell[];
    simulateMoveOnBoard(simBoard, move, side, state.enPassantTarget);
    const { board: propagated } = propagate(simBoard);

    // Forced collapse: a king-ish evader becomes the king when other
    // king-candidates remain attacked.
    const { board: finalBoard } = resolveForkCrown(
      state,
      propagated,
      side,
      beforeAttacked,
      move.from,
      move.to,
    );

    const simState: GameState = {
      ...state,
      board: finalBoard,
      turnNumber: state.turnNumber + 1,
    };

    // Castling: must not pass through or land in check
    if (move.kind === "castling") {
      const passThrough = squaresBetween(move.from, move.to);
      const attackingSide: Side = side === "white" ? "black" : "white";
      for (const sq of [move.from, ...passThrough, move.to]) {
        if (isSquareAttackedBy({ ...state, board: state.board }, sq, attackingSide)) {
          return false;
        }
      }
    }

    return !sideInCheck(simState, side);
  });
}

function simulateMoveOnBoard(
  board: Cell[],
  move: Move,
  side: Side,
  enPassantTarget: number | null,
): void {
  if (move.kind === "castling") {
    const kingCell = board[move.from];
    board[move.from] = null;
    board[move.to] =
      kingCell?.kind === "dude"
        ? { kind: "materialized", owner: side, piece: "K" }
        : (kingCell ?? null);
    board[move.rookFrom!] = null;
    board[move.rookTo!] = { kind: "materialized", owner: side, piece: "R" };
    return;
  }

  if (move.kind === "en-passant") {
    board[move.capturedPawnSquare!] = null;
    board[move.to] = board[move.from] ?? null;
    board[move.from] = null;
    return;
  }

  const mover = board[move.from];
  board[move.from] = null;

  if (move.kind === "promotion") {
    board[move.to] = { kind: "dude", owner: side, localCandidates: ["R", "N", "B", "Q", "K"] };
  } else if (mover?.kind === "dude") {
    const narrowed = narrowDudeMove({
      board,
      from: move.from,
      to: move.to,
      mover,
      candidates: mover.localCandidates,
      side,
      enPassantTarget,
    });
    // If narrowing emptied the set the move is illegal (rejected by
    // getLegalMoves before reaching here); fall back to the geometry set so the
    // simulated board still holds a valid occupant.
    const geomFallback = mover.localCandidates.filter((k) =>
      dudeKindsForMove(move.from, move.to).includes(k),
    );
    board[move.to] = {
      ...mover,
      localCandidates:
        narrowed.length > 0
          ? narrowed
          : geomFallback.length > 0
            ? geomFallback
            : mover.localCandidates,
    };
  } else {
    board[move.to] = mover ?? null;
  }
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
