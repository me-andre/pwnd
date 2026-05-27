import { describe, expect, it } from "vitest";
import { effectiveCandidates, hasLiveQueen, propagate } from "../src/candidates.js";
import type { Cell } from "../src/types.js";
import { buildState } from "./state-builder.js";

describe("effectiveCandidates", () => {
  it("returns full set when no global exclusions", () => {
    // Two dudes and a king so king-eager doesn't fire on the dude under test.
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D D . . K . . .
      turn: white
      castling: -
    `);
    const dude = state.board[0]!;
    expect(dude.kind).toBe("dude");
    if (dude.kind === "dude") {
      const eff = effectiveCandidates(dude.localCandidates, state.board, "white");
      expect(eff).toContain("R");
      // Q and K excluded because materialized king is present
      expect(eff).not.toContain("K");
    }
  });

  it("excludes Q when a white queen is alive", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D . . Q K . . .
      turn: white
      castling: -
    `);
    const dude = state.board[0]!;
    if (dude.kind === "dude") {
      const eff = effectiveCandidates(dude.localCandidates, state.board, "white");
      expect(eff).not.toContain("Q");
      expect(eff).not.toContain("K"); // king materialized, so excluded
    }
  });

  it("excludes K when a white king is materialized", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D . . . K . . .
      turn: white
      castling: -
    `);
    const dude = state.board[0]!;
    if (dude.kind === "dude") {
      const eff = effectiveCandidates(dude.localCandidates, state.board, "white");
      expect(eff).not.toContain("K");
    }
  });
});

describe("propagate — queen uniqueness / queen re-admission", () => {
  it("re-admits Q to dudes when a queen is captured", () => {
    // Board: white dude with {R,N,B,Q} local, white king, white queen.
    // With queen alive, effective Q is excluded.
    // After queen is removed, effective Q is restored.
    const board: Cell[] = Array(64).fill(null);
    board[4] = { kind: "materialized", owner: "white", piece: "K" };
    // Dude with local {R,N,B,Q} — note no K to avoid king-eager conflict
    board[0] = { kind: "dude", owner: "white", localCandidates: ["R", "N", "B", "Q"] };
    board[3] = { kind: "materialized", owner: "white", piece: "Q" };
    // Black king somewhere (avoids king-eager for black)
    board[60] = { kind: "materialized", owner: "black", piece: "K" };

    // After propagate with queen alive, dude should not change (R,N,B,Q narrowed
    // to R,N,B in effective — but local stays {R,N,B,Q})
    const withQueen = propagate(board);
    const dudeWithQueen = withQueen.board[0];
    expect(dudeWithQueen?.kind).toBe("dude");
    if (dudeWithQueen?.kind === "dude") {
      // Local candidates unchanged
      expect(dudeWithQueen.localCandidates).toContain("Q");
      // Effective candidates exclude Q
      expect(
        effectiveCandidates(dudeWithQueen.localCandidates, withQueen.board, "white"),
      ).not.toContain("Q");
    }

    // Remove queen (simulating capture):
    const boardNoQueen = [...withQueen.board] as Cell[];
    boardNoQueen[3] = null;
    const afterCapture = propagate(boardNoQueen);
    const dudeAfter = afterCapture.board[0];
    expect(dudeAfter?.kind).toBe("dude");
    if (dudeAfter?.kind === "dude") {
      // Effective candidates should re-admit Q
      expect(effectiveCandidates(dudeAfter.localCandidates, afterCapture.board, "white")).toContain(
        "Q",
      );
    }
  });
});

describe("propagate — king-eager", () => {
  it("materializes the last dude with K as king when all others lack K", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D[RNB] D[RNB] D[RNB] D[RNB] D[RNB] D[RNB] D[RNB] D[RNBQK]
      turn: white
      castling: -
    `);
    // The last dude (h1) is the only one with K in local set → materializes as king
    const kingSquare = 7; // h1
    const cell = state.board[kingSquare];
    expect(cell?.kind).toBe("materialized");
    if (cell?.kind === "materialized") {
      expect(cell.piece).toBe("K");
    }
  });

  it("does not eagerly materialize when multiple dudes have K", () => {
    const state = buildState(`
      8 . . . . k . . .
      7 . . . . . . . .
      6 . . . . . . . .
      5 . . . . . . . .
      4 . . . . . . . .
      3 . . . . . . . .
      2 . . . . . . . .
      1 D D . . . . . .
      turn: white
      castling: -
    `);
    // Both dudes have K in local set → neither materializes as king
    const a1 = state.board[0];
    const b1 = state.board[1];
    expect(a1?.kind).toBe("dude");
    expect(b1?.kind).toBe("dude");
  });
});

describe("hasLiveQueen", () => {
  it("returns true when queen is on board", () => {
    const board: Cell[] = Array(64).fill(null);
    board[0] = { kind: "materialized", owner: "white", piece: "Q" };
    expect(hasLiveQueen(board, "white")).toBe(true);
    expect(hasLiveQueen(board, "black")).toBe(false);
  });
});
