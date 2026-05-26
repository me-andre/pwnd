// ── Primitives ────────────────────────────────────────────────────────────────

export type Side = "white" | "black";

/** Materialized piece kinds (standard chess notation). */
export type PieceKind = "R" | "N" | "B" | "Q" | "K" | "P";

/** The five non-pawn piece kinds a dude may collapse into. */
export type DudeKind = "R" | "N" | "B" | "Q" | "K";

/** All five non-pawn kinds, used as the widest possible candidate set. */
export const ALL_DUDE_KINDS: readonly DudeKind[] = ["R", "N", "B", "Q", "K"];

// ── Squares ───────────────────────────────────────────────────────────────────

/** 0-based board index: 0 = a1, 7 = h1, 56 = a8, 63 = h8. */
export type SquareIndex = number;

/** File letter a–h. */
export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

/** Rank number 1–8. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Square {
  file: File;
  rank: Rank;
}

// ── Cells (board positions) ───────────────────────────────────────────────────

export interface MaterializedPiece {
  kind: "materialized";
  owner: Side;
  piece: PieceKind;
}

export interface Dude {
  kind: "dude";
  owner: Side;
  /**
   * Local candidate set — the piece types consistent with this dude's own
   * move history. Stored as a sorted string for easy equality checks.
   * Effective set is computed on demand: local ∩ global constraints.
   */
  localCandidates: ReadonlyArray<DudeKind>;
}

export type Occupant = MaterializedPiece | Dude;

/** A cell in the board. `null` means empty. */
export type Cell = Occupant | null;

// ── Moves ─────────────────────────────────────────────────────────────────────

export type MoveKind =
  | "normal" // standard move or capture
  | "promotion" // pawn reaches back rank → becomes dude
  | "castling" // king + rook-dude partner
  | "en-passant"; // pawn captures en-passant

export interface Move {
  kind: MoveKind;
  from: SquareIndex;
  to: SquareIndex;
  /** Index of the rook/dude partner (castling only). */
  rookFrom?: SquareIndex;
  rookTo?: SquareIndex;
  /** For en-passant: square of the captured pawn. */
  capturedPawnSquare?: SquareIndex;
}

// ── Replayed move (for animation) ─────────────────────────────────────────────

export type ReplayedMoveStatus = "accepted" | "rejected";

export interface ReplayedMove {
  status: ReplayedMoveStatus;
  move: Move;
  /** Squares where materialization occurred this ply. */
  materializedSquares: ReadonlyArray<SquareIndex>;
}

// ── Game result ───────────────────────────────────────────────────────────────

export type GameResult =
  | { status: "ongoing" }
  | { status: "win"; winner: Side }
  | { status: "draw" };

// ── Castling rights ───────────────────────────────────────────────────────────

export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

// ── Game state ────────────────────────────────────────────────────────────────

export interface GameState {
  /** 64-cell board. Index 0 = a1, index 63 = h8. */
  board: ReadonlyArray<Cell>;
  /** Number of half-moves (plies) played so far. Turn = ply % 2 === 0 → white. */
  turnNumber: number;
  /** Ordered list of accepted moves for replay/persistence. */
  moveLog: ReadonlyArray<Move>;
  castlingRights: CastlingRights;
  result: GameResult;
  /**
   * The square index of an en-passant target square (the square a pawn passed
   * through on a double-push), or null.
   */
  enPassantTarget: SquareIndex | null;
}
