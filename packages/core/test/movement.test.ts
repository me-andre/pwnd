import { describe, expect, it } from "vitest";
import { algebraicToIndex } from "../src/squares.js";
import {
  bishopSquares,
  dudeKindsForMove,
  kingSquares,
  knightSquares,
  queenSquares,
  rookSquares,
} from "../src/movement.js";

describe("rookSquares", () => {
  it("e4 has 14 squares on empty board", () => {
    const e4 = algebraicToIndex("e4");
    expect(rookSquares(e4)).toHaveLength(14);
  });

  it("a1 has 14 squares on empty board", () => {
    const a1 = algebraicToIndex("a1");
    expect(rookSquares(a1)).toHaveLength(14);
  });
});

describe("knightSquares", () => {
  it("e4 has 8 knight moves", () => {
    const e4 = algebraicToIndex("e4");
    expect(knightSquares(e4)).toHaveLength(8);
  });

  it("a1 has 2 knight moves", () => {
    const a1 = algebraicToIndex("a1");
    expect(knightSquares(a1)).toHaveLength(2);
  });

  it("b3 can jump to a1 (knight move)", () => {
    const b3 = algebraicToIndex("b3");
    const a1 = algebraicToIndex("a1");
    expect(knightSquares(b3)).toContain(a1);
  });
});

describe("bishopSquares", () => {
  it("e4 has 13 bishop squares on empty board", () => {
    const e4 = algebraicToIndex("e4");
    expect(bishopSquares(e4)).toHaveLength(13);
  });
});

describe("queenSquares", () => {
  it("e4 has 27 queen squares on empty board", () => {
    const e4 = algebraicToIndex("e4");
    expect(queenSquares(e4)).toHaveLength(27);
  });
});

describe("kingSquares", () => {
  it("e4 has 8 king squares", () => {
    const e4 = algebraicToIndex("e4");
    expect(kingSquares(e4)).toHaveLength(8);
  });

  it("a1 has 3 king squares", () => {
    const a1 = algebraicToIndex("a1");
    expect(kingSquares(a1)).toHaveLength(3);
  });
});

describe("dudeKindsForMove", () => {
  it("a1→b3 is only a knight move", () => {
    const a1 = algebraicToIndex("a1");
    const b3 = algebraicToIndex("b3");
    const kinds = dudeKindsForMove(a1, b3);
    expect(kinds).toEqual(["N"]);
  });

  it("a1→h8 is bishop and queen", () => {
    const a1 = algebraicToIndex("a1");
    const h8 = algebraicToIndex("h8");
    const kinds = dudeKindsForMove(a1, h8);
    expect(kinds).toContain("B");
    expect(kinds).toContain("Q");
    expect(kinds).not.toContain("R");
    expect(kinds).not.toContain("N");
    expect(kinds).not.toContain("K");
  });

  it("a1→a8 is rook and queen", () => {
    const a1 = algebraicToIndex("a1");
    const a8 = algebraicToIndex("a8");
    const kinds = dudeKindsForMove(a1, a8);
    expect(kinds).toContain("R");
    expect(kinds).toContain("Q");
    expect(kinds).not.toContain("B");
    expect(kinds).not.toContain("N");
    expect(kinds).not.toContain("K");
  });

  it("e1→e2 is rook, queen, and king (one step straight)", () => {
    const e1 = algebraicToIndex("e1");
    const e2 = algebraicToIndex("e2");
    const kinds = dudeKindsForMove(e1, e2);
    expect(kinds).toContain("R");
    expect(kinds).toContain("Q");
    expect(kinds).toContain("K");
    expect(kinds).not.toContain("N");
    expect(kinds).not.toContain("B");
  });
});
