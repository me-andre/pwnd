import { effectiveCandidates, propagate } from "./candidates.js";
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
import { fileOf, rankOf } from "./squares.js";
import type {
  Cell,
  CastlingRights,
  DudeKind,
  GameState,
  Move,
  ReplayedMove,
  Side,
} from "./types.js";

// ── Board query helpers ───────────────────────────────────────────────────────

function isOccupied(board: ReadonlyArray<Cell>, sq: number): boolean {
  return board[sq] !== null;
}

function isFriendly(board: ReadonlyArray<Cell>, side: Side, sq: number): boolean {
  const cell = board[sq];
  return cell !== null && cell.owner === side;
}

function isEnemy(board: ReadonlyArray<Cell>, side: Side, sq: number): boolean {
  const cell = board[sq];
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
  if (cell === null) return [];

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
  if (cell === null || cell.owner !== side) return false;
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
    if (cell !== null && cell.kind === "materialized" && cell.owner === side && cell.piece === "K") {
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
export function isSquareAttackedBy(
  state: GameState,
  square: number,
  attackingSide: Side,
): boolean {
  const { board } = state;
  for (let i = 0; i < 64; i++) {
    const cell = board[i];
    if (cell === null || cell.owner !== attackingSide) continue;
    const candidates = getCandidateMoves(state, i);
    if (candidates.some((m) => m.to === square)) return true;
  }
  return false;
}

export function findKingCandidateUnderAttack(
  state: GameState,
  side: Side,
): number | null {
  const attackingSide: Side = side === "white" ? "black" : "white";
  for (let i = 0; i < 64; i++) {
    const cell = state.board[i];
    if (cell === null || cell.kind !== "dude" || cell.owner !== side) continue;
    const eff = effectiveCandidates(cell.localCandidates, state.board, side);
    if (!eff.includes("K")) continue;
    if (isSquareAttackedBy(state, i, attackingSide)) return i;
  }
  return null;
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

  if (cell === null) return reject(state, move, "No piece at source");
  if (cell.owner !== side) return reject(state, move, "Not your piece");

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
    return executeCastling(state, move, side);
  }
  if (move.kind === "en-passant") {
    return executeEnPassant(state, move, side);
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
    const geometryCandidates = dudeKindsForMove(move.from, move.to);
    const eff = effectiveCandidates(mover.localCandidates, board, side);
    const narrowed: DudeKind[] = eff.filter((k) => geometryCandidates.includes(k));
    if (narrowed.length === 0) return reject(state, move, "Move incompatible with all candidates");
    newBoard[move.to] = { ...mover, localCandidates: narrowed };
  } else {
    newBoard[move.to] = mover;
  }

  const newCastlingRights = updateCastlingRights(state.castlingRights, move, cell, side);
  const newEnPassant = computeEnPassant(move, cell);
  const { board: propagatedBoard, materializedSquares } = propagate(newBoard);

  const newState: GameState = {
    board: propagatedBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: newCastlingRights,
    result: { status: "ongoing" },
    enPassantTarget: newEnPassant,
  };

  if (isInCheck(newState, side)) {
    return reject(state, move, "Move leaves king in check");
  }

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

function executeCastling(state: GameState, move: Move, side: Side): ApplyMoveResult {
  const rookFrom = move.rookFrom!;
  const rookTo = move.rookTo!;
  const newBoard = [...state.board] as Cell[];

  const kingCell = newBoard[move.from]!;
  newBoard[move.from] = null;
  newBoard[move.to] =
    kingCell.kind === "dude"
      ? { kind: "materialized", owner: side, piece: "K" }
      : kingCell;

  newBoard[rookFrom] = null;
  newBoard[rookTo] = { kind: "materialized", owner: side, piece: "R" };

  const newCastlingRights = revokeCastlingForSide(state.castlingRights, side);
  const { board: propagatedBoard, materializedSquares } = propagate(newBoard);

  const newState: GameState = {
    board: propagatedBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: newCastlingRights,
    result: { status: "ongoing" },
    enPassantTarget: null,
  };

  if (isInCheck(newState, side)) {
    return reject(state, move, "Castling into check");
  }

  const opponent: Side = side === "white" ? "black" : "white";
  const finalState = computeResult(newState, opponent);

  return {
    nextState: finalState,
    accepted: true,
    replayedMove: { status: "accepted", move, materializedSquares },
  };
}

function executeEnPassant(state: GameState, move: Move, side: Side): ApplyMoveResult {
  const capturedPawnSquare = move.capturedPawnSquare!;
  const newBoard = [...state.board] as Cell[];
  newBoard[move.from] = null;
  newBoard[capturedPawnSquare] = null;
  newBoard[move.to] = state.board[move.from];

  const { board: propagatedBoard, materializedSquares } = propagate(newBoard);

  const newState: GameState = {
    board: propagatedBoard,
    turnNumber: state.turnNumber + 1,
    moveLog: [...state.moveLog, move],
    castlingRights: state.castlingRights,
    result: { status: "ongoing" },
    enPassantTarget: null,
  };

  if (isInCheck(newState, side)) {
    return reject(state, move, "Move leaves king in check");
  }

  const opponent: Side = side === "white" ? "black" : "white";
  const finalState = computeResult(newState, opponent);

  return {
    nextState: finalState,
    accepted: true,
    replayedMove: { status: "accepted", move, materializedSquares },
  };
}

// ── Legal moves (checking for self-check) ─────────────────────────────────────

export function getLegalMoves(state: GameState, from: number): Move[] {
  const cell = state.board[from];
  if (cell === null) return [];

  const candidates = getCandidateMoves(state, from);
  return candidates.filter((move) => {
    const simBoard = [...state.board] as Cell[];
    simulateMoveOnBoard(simBoard, move, cell.owner);
    const { board: propagated } = propagate(simBoard);
    const simState: GameState = {
      ...state,
      board: propagated,
      turnNumber: state.turnNumber + 1,
    };

    // Castling: must not pass through or land in check
    if (move.kind === "castling") {
      const passThrough = squaresBetween(move.from, move.to);
      const attackingSide: Side = cell.owner === "white" ? "black" : "white";
      for (const sq of [move.from, ...passThrough, move.to]) {
        if (isSquareAttackedBy({ ...state, board: state.board }, sq, attackingSide)) {
          return false;
        }
      }
    }

    return !isInCheck(simState, cell.owner);
  });
}

function simulateMoveOnBoard(board: Cell[], move: Move, side: Side): void {
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
    board[move.to] = board[move.from];
    board[move.from] = null;
    return;
  }

  const mover = board[move.from];
  board[move.from] = null;

  if (move.kind === "promotion") {
    board[move.to] = { kind: "dude", owner: side, localCandidates: ["R", "N", "B", "Q", "K"] };
  } else if (mover?.kind === "dude") {
    const geom = dudeKindsForMove(move.from, move.to);
    const narrowed = mover.localCandidates.filter((k) => geom.includes(k));
    board[move.to] = {
      ...mover,
      localCandidates: narrowed.length > 0 ? narrowed : mover.localCandidates,
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
  const inCheck = isInCheck(state, side);
  const candidateUnderAttack = findKingCandidateUnderAttack(state, side);
  if (!inCheck && candidateUnderAttack === null) return false;

  for (let i = 0; i < 64; i++) {
    const cell = state.board[i];
    if (cell === null || cell.owner !== side) continue;
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
