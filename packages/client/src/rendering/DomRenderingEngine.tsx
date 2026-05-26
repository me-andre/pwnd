import type { Cell, GameState } from "@pwnd/core";
import { ALL_DUDE_KINDS, effectiveCandidates } from "@pwnd/core";
import { Box, Tooltip } from "@mui/material";
import type { ReactNode } from "react";
import type { RenderOptions, RenderingEngine } from "./RenderingEngine.js";

// ── Piece symbols ─────────────────────────────────────────────────────────────

const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  white: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  black: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

/** Character used for a dude at full or partially-narrowed superposition. */
const DUDE_SYMBOL = "⬡";

// ── Board utilities ───────────────────────────────────────────────────────────

function squareColor(fileIdx: number, rankIdx: number): string {
  return (fileIdx + rankIdx) % 2 === 0 ? "#b58863" : "#f0d9b5";
}

function cellContent(cell: Cell, board: GameState["board"]): string {
  if (cell === null) return "";
  if (cell.kind === "materialized") return PIECE_SYMBOLS[cell.owner]?.[cell.piece] ?? "?";
  // Dude: show collapsed symbol regardless of narrowing width
  // (per CONCEPT §2.6 UI choice: only materialize visually on full collapse)
  return DUDE_SYMBOL;
}

function cellTooltip(cell: Cell, board: GameState["board"]): string {
  if (cell === null) return "";
  if (cell.kind === "materialized") {
    const names: Record<string, string> = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" };
    return `${cell.owner === "white" ? "White" : "Black"} ${names[cell.piece] ?? cell.piece}`;
  }
  const eff = effectiveCandidates(cell.localCandidates, board, cell.owner);
  const fullKinds = ALL_DUDE_KINDS.slice();
  const isFullSuper = eff.length === fullKinds.length && fullKinds.every((k) => eff.includes(k));
  const kindNames: Record<string, string> = { R: "Rook", N: "Knight", B: "Bishop", Q: "Queen", K: "King" };
  const effStr = eff.map((k) => kindNames[k] ?? k).join(", ");
  return isFullSuper
    ? `${cell.owner === "white" ? "White" : "Black"} Dude (full superposition)`
    : `${cell.owner === "white" ? "White" : "Black"} Dude {${effStr}}`;
}

// ── DOM Rendering Engine ──────────────────────────────────────────────────────

const SQUARE_SIZE = 64;

export class DomRenderingEngine implements RenderingEngine {
  render({
    gameState,
    replayedMove,
    facePlayer,
    selectedSquare,
    legalDestinations,
    onSquareClick,
  }: RenderOptions): ReactNode {
    const { board } = gameState;
    const isFlipped = facePlayer === "black";

    const files = [0, 1, 2, 3, 4, 5, 6, 7];
    const ranks = [0, 1, 2, 3, 4, 5, 6, 7];
    const displayFiles = isFlipped ? [...files].reverse() : files;
    const displayRanks = isFlipped ? ranks : [...ranks].reverse();

    const lastMove = replayedMove?.move ?? null;

    return (
      <Box
        component="div"
        sx={{
          display: "inline-flex",
          flexDirection: "column",
          border: "3px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          userSelect: "none",
        }}
      >
        {displayRanks.map((rankIdx) => (
          <Box key={rankIdx} sx={{ display: "flex" }}>
            {/* Rank label */}
            <Box
              sx={{
                width: 18,
                height: SQUARE_SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.6rem",
                fontWeight: 600,
                color: "text.secondary",
                bgcolor: "background.paper",
              }}
            >
              {rankIdx + 1}
            </Box>

            {displayFiles.map((fileIdx) => {
              const squareIdx = rankIdx * 8 + fileIdx;
              const cell = board[squareIdx];

              const isSelected = selectedSquare === squareIdx;
              const isLegalDest = legalDestinations.includes(squareIdx);
              const isLastMoveFrom =
                lastMove !== null &&
                replayedMove?.status === "accepted" &&
                lastMove.from === squareIdx;
              const isLastMoveTo =
                lastMove !== null &&
                replayedMove?.status === "accepted" &&
                (lastMove.to === squareIdx || lastMove.rookTo === squareIdx);
              const isRejectedFrom =
                lastMove !== null &&
                replayedMove?.status === "rejected" &&
                lastMove.from === squareIdx;
              const justMaterialized = replayedMove?.materializedSquares.includes(squareIdx) ?? false;

              const baseColor = squareColor(fileIdx, rankIdx);
              const symbol = cellContent(cell, board);
              const tip = cellTooltip(cell, board);
              const isDude = cell?.kind === "dude";

              let bgOverlay = "none";
              if (isSelected) bgOverlay = "rgba(20, 85, 30, 0.65)";
              else if (isLastMoveFrom || isLastMoveTo) bgOverlay = "rgba(155, 199, 0, 0.38)";

              return (
                <Tooltip
                  key={fileIdx}
                  title={tip || undefined}
                  placement="top"
                  arrow
                  disableInteractive
                >
                  <Box
                    onClick={() => onSquareClick(squareIdx)}
                    sx={{
                      width: SQUARE_SIZE,
                      height: SQUARE_SIZE,
                      bgcolor: baseColor,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      "&:hover": {
                        filter: "brightness(1.1)",
                      },
                      // Overlay (selection / last move highlight)
                      "&::before":
                        bgOverlay !== "none"
                          ? {
                              content: '""',
                              position: "absolute",
                              inset: 0,
                              bgcolor: bgOverlay,
                              pointerEvents: "none",
                            }
                          : undefined,
                      // Rejection shake animation
                      animation: isRejectedFrom
                        ? "shake 0.3s ease"
                        : justMaterialized
                          ? "materialize 0.5s ease"
                          : "none",
                      "@keyframes shake": {
                        "0%,100%": { transform: "translateX(0)" },
                        "25%": { transform: "translateX(-4px)" },
                        "75%": { transform: "translateX(4px)" },
                      },
                      "@keyframes materialize": {
                        "0%": { filter: "brightness(2) saturate(0)" },
                        "100%": { filter: "brightness(1) saturate(1)" },
                      },
                    }}
                  >
                    {/* Legal destination indicator */}
                    {isLegalDest && (
                      <Box
                        sx={{
                          position: "absolute",
                          width: cell !== null ? "100%" : 22,
                          height: cell !== null ? "100%" : 22,
                          borderRadius: cell !== null ? 0 : "50%",
                          bgcolor:
                            cell !== null
                              ? "transparent"
                              : "rgba(20,85,30,0.55)",
                          border:
                            cell !== null
                              ? "3px solid rgba(20,85,30,0.75)"
                              : "none",
                          pointerEvents: "none",
                        }}
                      />
                    )}

                    {/* Piece / dude symbol */}
                    {symbol && (
                      <Box
                        sx={{
                          fontSize: isDude ? "1.8rem" : "2.4rem",
                          lineHeight: 1,
                          zIndex: 1,
                          color: cell?.owner === "white" ? "#fff" : "#1a1a1a",
                          textShadow:
                            cell?.owner === "white"
                              ? "0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.6)"
                              : "0 1px 3px rgba(255,255,255,0.5)",
                          transition: "transform 0.15s ease",
                          transform: isSelected ? "scale(1.15)" : "scale(1)",
                          opacity: isDude ? 0.7 : 1,
                        }}
                      >
                        {symbol}
                      </Box>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        ))}

        {/* File labels row */}
        <Box sx={{ display: "flex" }}>
          <Box sx={{ width: 18, height: 18, bgcolor: "background.paper" }} />
          {displayFiles.map((fileIdx) => (
            <Box
              key={fileIdx}
              sx={{
                width: SQUARE_SIZE,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.6rem",
                fontWeight: 600,
                color: "text.secondary",
                bgcolor: "background.paper",
              }}
            >
              {String.fromCharCode("a".charCodeAt(0) + fileIdx)}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }
}
