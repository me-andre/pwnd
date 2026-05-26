import type {
  Cell,
  DudeKind,
  GameState,
  Move,
  Side,
  SquareIndex,
} from "@pwnd/core";
import {
  ALL_DUDE_KINDS,
  effectiveCandidates,
  fileOf,
  indexToAlgebraic,
  rankOf,
} from "@pwnd/core";
import { Box, Tooltip } from "@mui/material";
import type { ReactNode } from "react";
import type { RenderOptions, RenderingEngine } from "./RenderingEngine.js";

// ── Piece symbols ─────────────────────────────────────────────────────────────

const WHITE_SYMBOLS: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
};

const BLACK_SYMBOLS: Record<string, string> = {
  K: "♚",
  Q: "♛",
  R: "♜",
  B: "♝",
  N: "♞",
  P: "♟",
};

const DUDE_SYMBOL = "⬡";
const DUDE_SYMBOL_NARROW = "◈";

// ── Cell content ──────────────────────────────────────────────────────────────

function cellSymbol(cell: Cell, board: GameState["board"]): string {
  if (cell === null) return "";
  if (cell.kind === "materialized") {
    const map = cell.owner === "white" ? WHITE_SYMBOLS : BLACK_SYMBOLS;
    return map[cell.piece] ?? "?";
  }
  // Dude
  const eff = effectiveCandidates(cell.localCandidates, board, cell.owner);
  if (eff.length === ALL_DUDE_KINDS.length) return DUDE_SYMBOL;
  return DUDE_SYMBOL_NARROW;
}

function cellTooltip(cell: Cell, board: GameState["board"]): string {
  if (cell === null) return "";
  if (cell.kind === "materialized") return `${cell.owner} ${cell.piece}`;
  const eff = effectiveCandidates(cell.localCandidates, board, cell.owner);
  return `${cell.owner} dude {${eff.join(",")}}`;
}

// ── Square colours ────────────────────────────────────────────────────────────

function squareColor(fileIdx: number, rankIdx: number): string {
  return (fileIdx + rankIdx) % 2 === 0 ? "#b58863" : "#f0d9b5";
}

// ── DOM Rendering Engine ──────────────────────────────────────────────────────

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
        sx={{
          display: "inline-block",
          border: "2px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {/* Rank labels left column + board rows */}
        {displayRanks.map((rankIdx) => (
          <Box key={rankIdx} sx={{ display: "flex" }}>
            {/* Rank label */}
            <Box
              sx={{
                width: 20,
                height: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                color: "text.secondary",
                bgcolor: "background.paper",
              }}
            >
              {rankIdx + 1}
            </Box>
            {displayFiles.map((fileIdx) => {
              const squareIdx: SquareIndex = rankIdx * 8 + fileIdx;
              const cell = board[squareIdx];
              const isSelected = selectedSquare === squareIdx;
              const isLegal = legalDestinations.includes(squareIdx);
              const isLastMoveFrom =
                lastMove !== null && lastMove.from === squareIdx && replayedMove?.status === "accepted";
              const isLastMoveTo =
                lastMove !== null && lastMove.to === squareIdx && replayedMove?.status === "accepted";
              const isRejected =
                lastMove !== null &&
                lastMove.from === squareIdx &&
                replayedMove?.status === "rejected";
              const isMaterialized =
                replayedMove?.materializedSquares.includes(squareIdx) ?? false;

              const baseColor = squareColor(fileIdx, rankIdx);
              let overlayColor: string | undefined;
              if (isSelected) overlayColor = "rgba(20, 85, 30, 0.6)";
              else if (isLastMoveFrom || isLastMoveTo) overlayColor = "rgba(155, 199, 0, 0.41)";

              const symbol = cellSymbol(cell, board);
              const tooltip = cellTooltip(cell, board);

              return (
                <Tooltip key={fileIdx} title={tooltip} placement="top" arrow disableHoverListener={!tooltip}>
                  <Box
                    onClick={() => onSquareClick(squareIdx)}
                    sx={{
                      width: 60,
                      height: 60,
                      bgcolor: baseColor,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: cell !== null || isLegal ? "pointer" : "default",
                      "&::after": overlayColor
                        ? {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            bgcolor: overlayColor,
                          }
                        : undefined,
                      transition: "filter 0.15s",
                      filter: isRejected ? "sepia(1) saturate(4) hue-rotate(-30deg)" : "none",
                      animation: isMaterialized ? "fadeIn 0.4s ease" : "none",
                      "@keyframes fadeIn": {
                        from: { opacity: 0, transform: "scale(0.5)" },
                        to: { opacity: 1, transform: "scale(1)" },
                      },
                    }}
                  >
                    {/* Legal destination dot */}
                    {isLegal && (
                      <Box
                        sx={{
                          position: "absolute",
                          width: cell !== null ? "100%" : 20,
                          height: cell !== null ? "100%" : 20,
                          borderRadius: cell !== null ? 0 : "50%",
                          bgcolor:
                            cell !== null
                              ? "rgba(20, 85, 30, 0.4)"
                              : "rgba(20, 85, 30, 0.5)",
                          border: cell !== null ? "3px solid rgba(20, 85, 30, 0.7)" : "none",
                        }}
                      />
                    )}
                    {/* Piece/dude symbol */}
                    {symbol && (
                      <Box
                        sx={{
                          fontSize: symbol === DUDE_SYMBOL || symbol === DUDE_SYMBOL_NARROW ? "1.6rem" : "2.2rem",
                          lineHeight: 1,
                          zIndex: 1,
                          color:
                            cell?.owner === "white"
                              ? "#fff"
                              : "#222",
                          textShadow:
                            cell?.owner === "white"
                              ? "0 1px 3px rgba(0,0,0,0.8)"
                              : "0 1px 3px rgba(255,255,255,0.4)",
                          transition: "transform 0.2s",
                          transform: isSelected ? "scale(1.1)" : "scale(1)",
                          opacity: cell?.kind === "dude" ? 0.75 : 1,
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
          <Box sx={{ width: 20, height: 20, bgcolor: "background.paper" }} />
          {displayFiles.map((fileIdx) => (
            <Box
              key={fileIdx}
              sx={{
                width: 60,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
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
