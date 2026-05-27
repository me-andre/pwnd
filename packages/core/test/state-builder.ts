/**
 * State-builder: parse ASCII board literals into GameState objects for tests.
 * See STATE_FORMAT.md for the format specification.
 */

import { propagate } from "../src/candidates.js";
import type { Cell, DudeKind, GameResult, GameState, Side } from "../src/types.js";

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parse a board literal into a GameState.
 *
 * @example
 * ```ts
 * const state = buildState(`
 *   8 . . . . . . . .
 *   7 p p p p p p p p
 *   ...
 *   turn: white
 *   castling: KQkq
 * `);
 * ```
 */
export function buildState(literal: string): GameState {
  const lines = literal
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const board: Cell[] = Array(64).fill(null);
  let turn: Side = "white";
  let castlingStr = "KQkq";
  let enPassantStr: string | null = null;
  let result: GameResult = { status: "ongoing" };

  for (const line of lines) {
    // Metadata lines
    if (line.startsWith("turn:")) {
      turn = line.replace("turn:", "").trim() as Side;
      continue;
    }
    if (line.startsWith("castling:")) {
      castlingStr = line.replace("castling:", "").trim();
      continue;
    }
    if (line.startsWith("enPassant:")) {
      enPassantStr = line.replace("enPassant:", "").trim();
      continue;
    }
    if (line.startsWith("result:")) {
      const rStr = line.replace("result:", "").trim();
      if (rStr === "draw") result = { status: "draw" };
      else if (rStr.startsWith("win")) {
        const winner = rStr.split(" ")[1] as Side;
        result = { status: "win", winner };
      } else {
        result = { status: "ongoing" };
      }
      continue;
    }

    // Board rows: "8 . D . ..."
    const match = line.match(/^([1-8])\s+(.+)$/);
    if (!match) continue;
    const rank = Number.parseInt(match[1]!, 10);
    const rest = match[2]!;
    const tokens = tokenizeRow(rest);

    for (let fileIdx = 0; fileIdx < Math.min(tokens.length, 8); fileIdx++) {
      const token = tokens[fileIdx]!;
      const squareIdx = (rank - 1) * 8 + fileIdx;
      board[squareIdx] = parseToken(token);
    }
  }

  const castlingRights = parseCastling(castlingStr);
  const enPassantTarget = enPassantStr != null ? parseEnPassant(enPassantStr) : null;

  // Run propagation to apply global constraints
  const { board: propagatedBoard } = propagate(board);

  return {
    board: propagatedBoard,
    turnNumber: turn === "white" ? 0 : 1,
    moveLog: [],
    castlingRights,
    result,
    enPassantTarget,
  };
}

// ── Token parsing ─────────────────────────────────────────────────────────────

/**
 * Tokenize a board row, handling bracket notation like D[BQK].
 * Returns exactly 8 tokens (one per file).
 */
function tokenizeRow(row: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < row.length && tokens.length < 8) {
    if (row[i] === " " || row[i] === "\t") {
      i++;
      continue;
    }
    if ((row[i] === "D" || row[i] === "d") && row[i + 1] === "[") {
      // Bracket notation: D[BQK] or d[bqk]
      const end = row.indexOf("]", i);
      if (end === -1) {
        tokens.push(row[i]!);
        i++;
      } else {
        tokens.push(row.slice(i, end + 1));
        i = end + 1;
      }
    } else {
      tokens.push(row[i]!);
      i++;
    }
  }
  return tokens;
}

function parseToken(token: string): Cell {
  if (token === ".") return null;

  // Materialized pieces (uppercase = white, lowercase = black)
  const matMap: Record<string, { owner: Side; piece: string }> = {
    P: { owner: "white", piece: "P" },
    p: { owner: "black", piece: "P" },
    R: { owner: "white", piece: "R" },
    r: { owner: "black", piece: "R" },
    N: { owner: "white", piece: "N" },
    n: { owner: "black", piece: "N" },
    B: { owner: "white", piece: "B" },
    b: { owner: "black", piece: "B" },
    Q: { owner: "white", piece: "Q" },
    q: { owner: "black", piece: "Q" },
    K: { owner: "white", piece: "K" },
    k: { owner: "black", piece: "K" },
  };

  if (matMap[token]) {
    const m = matMap[token]!;
    return {
      kind: "materialized",
      owner: m.owner,
      piece: m.piece as import("../src/types.js").PieceKind,
    };
  }

  // Full-superposition dude
  if (token === "D") {
    return { kind: "dude", owner: "white", localCandidates: ["R", "N", "B", "Q", "K"] };
  }
  if (token === "d") {
    return { kind: "dude", owner: "black", localCandidates: ["R", "N", "B", "Q", "K"] };
  }

  // Narrowed dude: D[BQK] or d[bqk]
  const narrowedMatch = token.match(/^([Dd])\[([RNBQKrnbqk]+)\]$/);
  if (narrowedMatch) {
    const owner: Side = narrowedMatch[1] === "D" ? "white" : "black";
    const letters = narrowedMatch[2]!.toUpperCase().split("");
    const candidates = letters.filter((l): l is DudeKind => ["R", "N", "B", "Q", "K"].includes(l));
    return { kind: "dude", owner, localCandidates: candidates };
  }

  throw new Error(`Unknown token: "${token}"`);
}

function parseCastling(s: string): import("../src/types.js").CastlingRights {
  return {
    whiteKingSide: s.includes("K"),
    whiteQueenSide: s.includes("Q"),
    blackKingSide: s.includes("k"),
    blackQueenSide: s.includes("q"),
  };
}

function parseEnPassant(s: string): number | null {
  if (s === "-" || s === "") return null;
  const file = s.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number.parseInt(s[1]!, 10) - 1;
  return rank * 8 + file;
}
