/**
 * Board coordinate utilities.
 *
 * Local frame: square (file, rank) lives at position (file - 3.5, 0, -(rank - 3.5)).
 * Rank 0 (white back rank) is at z = +3.5 (near the default white camera).
 * Rank 7 (black back rank) is at z = -3.5 (far from white camera).
 * One world unit = one square.
 */

export function squareIdxToFileRank(idx: number): [number, number] {
  return [idx % 8, Math.floor(idx / 8)];
}

/** Returns [x, y, z] board-local position for a square index (0..63). */
export function squareIdxToPos(idx: number): [number, number, number] {
  const [file, rank] = squareIdxToFileRank(idx);
  return [file - 3.5, 0, -(rank - 3.5)];
}

export function fileRankToSquareIdx(file: number, rank: number): number {
  return rank * 8 + file;
}
