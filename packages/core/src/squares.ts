import type { File, Rank, Square, SquareIndex } from "./types.js";

const FILES: readonly File[] = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Convert a (file, rank) pair to a board index. */
export function squareIndex({ file, rank }: Square): SquareIndex {
  return (rank - 1) * 8 + FILES.indexOf(file);
}

/** Convert a board index to a (file, rank) pair. */
export function indexToSquare(idx: SquareIndex): Square {
  return {
    file: FILES[idx % 8] as File,
    rank: (Math.floor(idx / 8) + 1) as Rank,
  };
}

/** Convert "e4" style string to index. */
export function algebraicToIndex(alg: string): SquareIndex {
  const file = alg[0] as File;
  const rank = parseInt(alg[1] ?? "0", 10) as Rank;
  return squareIndex({ file, rank });
}

/** Convert index to algebraic "e4" style string. */
export function indexToAlgebraic(idx: SquareIndex): string {
  const sq = indexToSquare(idx);
  return `${sq.file}${sq.rank}`;
}

/** File (column) of a square index: 0–7. */
export function fileOf(idx: SquareIndex): number {
  return idx % 8;
}

/** Rank (row) of a square index: 0–7 (0 = rank 1). */
export function rankOf(idx: SquareIndex): number {
  return Math.floor(idx / 8);
}

/** Return the index offset by (deltaFile, deltaRank), or null if off-board. */
export function offset(
  idx: SquareIndex,
  deltaFile: number,
  deltaRank: number,
): SquareIndex | null {
  const f = fileOf(idx) + deltaFile;
  const r = rankOf(idx) + deltaRank;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return r * 8 + f;
}

/** All valid square indices. */
export function allSquares(): SquareIndex[] {
  return Array.from({ length: 64 }, (_, i) => i);
}
