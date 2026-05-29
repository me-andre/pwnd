export type {
  Side,
  PieceKind,
  DudeKind,
  SquareIndex,
  File,
  Rank,
  Square,
  MaterializedPiece,
  Dude,
  Occupant,
  Cell,
  MoveKind,
  Move,
  ReplayedMove,
  ReplayedMoveStatus,
  GameResult,
  CastlingRights,
  GameState,
} from "./types.js";

export { ALL_DUDE_KINDS } from "./types.js";

export {
  squareIndex,
  indexToSquare,
  algebraicToIndex,
  indexToAlgebraic,
  fileOf,
  rankOf,
  offset,
  allSquares,
} from "./squares.js";

export {
  hasLiveQueen,
  hasLiveKing,
  globalExclusions,
  effectiveCandidates,
  widestLocalCandidates,
  propagate,
  assertKingInvariant,
  sideHasKing,
} from "./candidates.js";

export { createInitialState } from "./initial-state.js";

export {
  rookSquares,
  bishopSquares,
  queenSquares,
  knightSquares,
  kingSquares,
  dudeKindsForMove,
  rookReachable,
  bishopReachable,
  queenReachable,
  knightReachable,
  kingReachable,
  pawnReachable,
  dudeReachable,
  squaresBetween,
} from "./movement.js";

export type { ApplyMoveResult } from "./apply-move.js";

export {
  getCandidateMoves,
  getCastlingMoves,
  getLegalMoves,
  getPossibleMovesForFigure,
  isInCheck,
  isCheckmate,
  isGameOver,
  whoseTurn,
  findMaterializedKing,
  isSquareAttackedBy,
  findKingCandidateUnderAttack,
  attackedKingCandidates,
  sideInCheck,
  applyMove,
} from "./apply-move.js";
