import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import {
  applyMove,
  createInitialState,
  findKingCandidateUnderAttack,
  findMaterializedKing,
  getLegalMoves,
  isCheckmate,
  isInCheck,
  whoseTurn,
} from "@pwnd/core";
import type { GameState, Move, ReplayedMove, Side } from "@pwnd/core";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThreeRenderingEngine } from "../rendering/three/ThreeRenderingEngine.js";
import { LocalStorageTransport } from "../transport/LocalStorageTransport.js";
import type { GameMode, GameSession } from "../transport/Transport.js";

// ── Route ─────────────────────────────────────────────────────────────────────

type GameSearch = { mode?: GameMode };

export const Route = createFileRoute("/game/$gameId")({
  validateSearch: (search: Record<string, unknown>): GameSearch => ({
    mode: (search.mode as GameMode | undefined) ?? "hotseat",
  }),
  component: GamePage,
});

// ── Singletons ────────────────────────────────────────────────────────────────

const transport = new LocalStorageTransport();
const renderingEngine = new ThreeRenderingEngine();

// ── State reconstruction ──────────────────────────────────────────────────────

function reconstructState(moves: Move[]): GameState {
  let state = createInitialState();
  for (const move of moves) {
    const result = applyMove(state, move);
    if (result.accepted) state = result.nextState;
  }
  return state;
}

// ── Game page ─────────────────────────────────────────────────────────────────

function GamePage() {
  const { gameId } = Route.useParams();
  const { mode = "hotseat" } = Route.useSearch();
  const navigate = useNavigate();

  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [replayedMove, setReplayedMove] = useState<ReplayedMove | null>(null);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showGameOverDialog, setShowGameOverDialog] = useState(false);
  const onboardingShown = useRef(false);
  const gameOverShown = useRef(false);

  // Load session
  useEffect(() => {
    (async () => {
      const s = await transport.loadSession(gameId);
      if (s === null) {
        void navigate({ to: "/" });
        return;
      }
      setSession(s);
      setLoading(false);
      if (!onboardingShown.current && s.moves.length === 0) {
        onboardingShown.current = true;
        setShowOnboarding(true);
      }
    })();
  }, [gameId, navigate]);

  const gameState = useMemo(() => (session ? reconstructState(session.moves) : null), [session]);

  // Show game-over dialog once
  useEffect(() => {
    if (gameState?.result.status !== "ongoing" && !gameOverShown.current) {
      gameOverShown.current = true;
      setTimeout(() => setShowGameOverDialog(true), 500);
    }
  }, [gameState?.result.status]);

  // Clear last-move highlights once the move animation + auto-facing rotation
  // have settled (~350 ms lerp + ~700 ms damped rotation = 1.2 s budget).
  // After the new player's turn has fully begun, the previous move's
  // from/to tints would otherwise remain green forever, which looks stale —
  // especially in solo/hotseat where the board has visibly rotated.
  useEffect(() => {
    if (replayedMove === null) return;
    const t = setTimeout(() => setReplayedMove(null), 1200);
    return () => clearTimeout(t);
  }, [replayedMove]);

  const currentSide: Side = gameState ? whoseTurn(gameState) : "white";

  // Board orientation
  const facePlayer: Side = useMemo((): Side => {
    if (mode === "tablet") return "white";
    // hotseat and solo: flip for current player
    return currentSide;
  }, [mode, currentSide]);

  // Legal destinations for selected square
  const legalDestinations = useMemo(() => {
    if (selectedSquare === null || gameState === null) return [];
    if (gameState.result.status !== "ongoing") return [];
    return getLegalMoves(gameState, selectedSquare).map((m) => m.to);
  }, [selectedSquare, gameState]);

  const handleSquareClick = useCallback(
    async (squareIdx: number) => {
      if (gameState === null || session === null) return;
      if (gameState.result.status !== "ongoing") return;

      // squareIdx is always 0-63 (emitted by SquarePicker), but the type is Cell | undefined
      // due to noUncheckedIndexedAccess. Guard once here so the rest uses Cell | null.
      const cell = gameState.board[squareIdx];
      if (cell === undefined) return;

      if (selectedSquare !== null) {
        // Same square → deselect
        if (squareIdx === selectedSquare) {
          setSelectedSquare(null);
          return;
        }

        // Own piece → switch selection
        if (cell !== null && cell.owner === currentSide) {
          setSelectedSquare(squareIdx);
          return;
        }

        // Try to move to clicked square
        const legal = getLegalMoves(gameState, selectedSquare);
        const candidates = legal.filter((m) => m.to === squareIdx);

        if (candidates.length === 0) {
          setSelectedSquare(null);
          return;
        }

        const move = candidates[0]!;
        const result = applyMove(gameState, move);
        setReplayedMove(result.replayedMove);
        setSelectedSquare(null);

        if (result.accepted) {
          const updated: GameSession = { ...session, moves: [...session.moves, move] };
          setSession(updated);
          await transport.saveSession(updated);
        } else {
          setSnackMessage(result.reason ?? "Move rejected");
        }
        return;
      }

      // No selection — select own piece
      if (cell !== null && cell.owner === currentSide) {
        const hasAnyLegal = getLegalMoves(gameState, squareIdx).length > 0;
        if (hasAnyLegal) setSelectedSquare(squareIdx);
      }
    },
    [gameState, session, selectedSquare, currentSide],
  );

  const handleRestart = async () => {
    if (session === null) return;
    const fresh: GameSession = {
      ...session,
      moves: [],
      createdAt: new Date().toISOString(),
    };
    setSession(fresh);
    await transport.saveSession(fresh);
    setSelectedSquare(null);
    setReplayedMove(null);
    setShowRestartDialog(false);
    setShowGameOverDialog(false);
    gameOverShown.current = false;
  };

  if (loading || gameState === null || session === null) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const isOver = gameState.result.status !== "ongoing";
  const inCheck = !isOver && isInCheck(gameState, currentSide);
  const kingCandidateSquare = isOver ? null : findKingCandidateUnderAttack(gameState, currentSide);
  const checkedOrCandidateAttacked = inCheck || kingCandidateSquare !== null;
  // Square to tint red: the attacked king-candidate dude, or — failing that —
  // the materialized king if it is in check.
  const checkSquare =
    kingCandidateSquare ?? (inCheck ? findMaterializedKing(gameState.board, currentSide) : null);
  const isMated = !isOver && isCheckmate(gameState, currentSide);

  const modeLabel: Record<GameMode, string> = {
    tablet: "Tablet",
    solo: "Solo",
    hotseat: "Hot-seat",
  };

  const resultText =
    gameState.result.status === "win"
      ? `${gameState.result.winner === "white" ? "White" : "Black"} wins!`
      : gameState.result.status === "draw"
        ? "Draw!"
        : null;

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 3,
          gap: 2,
        }}
      >
        {/* Header strip */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          justifyContent="center"
        >
          <Typography variant="h5" fontWeight={700} sx={{ mr: 1 }}>
            ♟ Pawn and Dude
          </Typography>
          <Chip label={modeLabel[mode]} size="small" variant="outlined" />
          {isOver ? (
            <Chip label={resultText ?? "Game over"} color="success" size="small" />
          ) : (
            <Chip
              label={`${currentSide === "white" ? "⬜ White" : "⬛ Black"}'s turn`}
              color={currentSide === "white" ? "default" : "secondary"}
              size="small"
            />
          )}
          {isMated && !isOver && <Chip label="Checkmate!" color="error" size="small" />}
          {checkedOrCandidateAttacked && !isMated && !isOver && (
            <Chip label="⚠ Check!" color="warning" size="small" />
          )}
        </Stack>

        {/* Board – 3D canvas container */}
        <Box
          sx={{
            width: "min(900px, 92vw)",
            aspectRatio: "1 / 1",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}
        >
          {renderingEngine.render({
            gameState,
            replayedMove,
            facePlayer,
            selectedSquare,
            legalDestinations,
            checkSquare,
            onSquareClick: handleSquareClick,
          })}
        </Box>

        {/* Controls */}
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" size="small" onClick={() => void navigate({ to: "/" })}>
            ← Menu
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="warning"
            onClick={() => setShowRestartDialog(true)}
          >
            Restart
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Move {Math.floor(session.moves.length / 2) + 1} · Ply {session.moves.length}
        </Typography>
      </Box>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Onboarding */}
      <Dialog
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Welcome to Pawn and Dude ♟</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              Every non-pawn piece starts as a <strong>Dude</strong> (shown as ⬡) — a piece in
              superposition over five types: Rook, Knight, Bishop, Queen, and King.
            </Typography>
            <Typography>
              <strong>Moving a Dude</strong> narrows its type to the piece types that could have
              made that move. When only one type remains, the Dude <em>materializes</em> into that
              piece.
            </Typography>
            <Typography>
              <strong>King rule:</strong> If only one Dude can still be a King, it materializes
              immediately — the position always has a potential king.
            </Typography>
            <Typography>
              <strong>Queen rule:</strong> At most one queen per side. If the queen is captured, the
              queen candidate type becomes available again for Dudes.
            </Typography>
            <Typography>
              <strong>Castling:</strong> Any unmoved back-rank Dude that can still be a Rook may
              partner with the king (or king-Dude) for castling. Both materialize.
            </Typography>
            <Typography>
              <strong>Promotion:</strong> A pawn reaching the back rank promotes into a new Dude
              (not a chosen piece type).
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Hover over a Dude to see its current candidate set.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOnboarding(false)} variant="contained">
            Got it, let's play!
          </Button>
        </DialogActions>
      </Dialog>

      {/* Game over */}
      <Dialog
        open={showGameOverDialog && isOver}
        onClose={() => setShowGameOverDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center", fontSize: "2rem" }}>
          {gameState.result.status === "win"
            ? gameState.result.winner === "white"
              ? "⬜ White wins!"
              : "⬛ Black wins!"
            : "Draw!"}
        </DialogTitle>
        <DialogContent>
          <Typography textAlign="center" color="text.secondary">
            Game over after {session.moves.length} plies.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 1, pb: 2 }}>
          <Button variant="contained" onClick={() => void handleRestart()}>
            Play again
          </Button>
          <Button variant="outlined" onClick={() => void navigate({ to: "/" })}>
            Main menu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restart confirmation */}
      <Dialog open={showRestartDialog} onClose={() => setShowRestartDialog(false)} maxWidth="xs">
        <DialogTitle>Restart game?</DialogTitle>
        <DialogContent>
          <Typography>
            All moves will be lost. The board will reset to the starting position.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRestartDialog(false)}>Cancel</Button>
          <Button onClick={() => void handleRestart()} color="warning" variant="contained">
            Restart
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejected move snack */}
      <Snackbar
        open={snackMessage !== null}
        autoHideDuration={2500}
        onClose={() => setSnackMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setSnackMessage(null)} sx={{ width: "100%" }}>
          {snackMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
