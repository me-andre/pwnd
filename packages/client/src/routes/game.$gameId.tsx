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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  applyMove,
  createInitialState,
  effectiveCandidates,
  findKingCandidateUnderAttack,
  getLegalMoves,
  isInCheck,
  whoseTurn,
} from "@pwnd/core";
import type { GameState, Move, ReplayedMove, Side } from "@pwnd/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DomRenderingEngine } from "../rendering/DomRenderingEngine.js";
import { LocalStorageTransport } from "../transport/LocalStorageTransport.js";
import type { GameMode, GameSession } from "../transport/Transport.js";

// ── Route definition ──────────────────────────────────────────────────────────

type GameSearch = { mode?: GameMode };

export const Route = createFileRoute("/game/$gameId")({
  validateSearch: (search: Record<string, unknown>): GameSearch => ({
    mode: (search.mode as GameMode | undefined) ?? "hotseat",
  }),
  component: GamePage,
});

// ── Singleton instances ───────────────────────────────────────────────────────

const transport = new LocalStorageTransport();
const renderingEngine = new DomRenderingEngine();

// ── State reconstruction ──────────────────────────────────────────────────────

function reconstructState(moves: Move[]): GameState {
  let state = createInitialState();
  for (const move of moves) {
    const result = applyMove(state, move);
    if (result.accepted) {
      state = result.nextState;
    }
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
  const onboardingShown = useRef(false);

  // Load session on mount
  useEffect(() => {
    (async () => {
      const s = await transport.loadSession(gameId);
      if (s === null) {
        await navigate({ to: "/" });
        return;
      }
      setSession(s);
      setLoading(false);
      if (!onboardingShown.current) {
        onboardingShown.current = true;
        setShowOnboarding(true);
      }
    })();
  }, [gameId, navigate]);

  const gameState = useMemo(
    () => (session ? reconstructState(session.moves) : null),
    [session],
  );

  const currentSide: Side = gameState ? whoseTurn(gameState) : "white";

  // Orientation per mode
  const facePlayer: Side = useMemo(() => {
    if (mode === "tablet") return "white";
    if (mode === "hotseat" || mode === "solo") return currentSide;
    return "white";
  }, [mode, currentSide]);

  const legalDestinations = useMemo(() => {
    if (selectedSquare === null || gameState === null) return [];
    return getLegalMoves(gameState, selectedSquare).map((m) => m.to);
  }, [selectedSquare, gameState]);

  const handleSquareClick = useCallback(
    async (squareIdx: number) => {
      if (gameState === null || session === null) return;
      if (gameState.result.status !== "ongoing") return;

      const cell = gameState.board[squareIdx];

      // If a square is already selected, try to move
      if (selectedSquare !== null) {
        if (squareIdx === selectedSquare) {
          setSelectedSquare(null);
          return;
        }

        // Check if clicking own piece → switch selection
        if (cell !== null && cell.owner === currentSide) {
          setSelectedSquare(squareIdx);
          return;
        }

        // Try to find a legal move to this square
        const legal = getLegalMoves(gameState, selectedSquare);
        const candidateMoves = legal.filter((m) => m.to === squareIdx);

        if (candidateMoves.length === 0) {
          setSelectedSquare(null);
          return;
        }

        // Pick the first legal move (could be promotion or castling)
        const move = candidateMoves[0]!;
        const result = applyMove(gameState, move);

        setReplayedMove(result.replayedMove);
        setSelectedSquare(null);

        if (result.accepted) {
          const updatedSession: GameSession = {
            ...session,
            moves: [...session.moves, move],
          };
          setSession(updatedSession);
          await transport.saveSession(updatedSession);
        } else {
          setSnackMessage(result.reason ?? "Move rejected");
        }
        return;
      }

      // No square selected — select if own piece
      if (cell !== null && cell.owner === currentSide) {
        setSelectedSquare(squareIdx);
      }
    },
    [gameState, session, selectedSquare, currentSide],
  );

  const handleRestart = async () => {
    if (session === null) return;
    const newSession: GameSession = {
      ...session,
      moves: [],
      createdAt: new Date().toISOString(),
    };
    setSession(newSession);
    await transport.saveSession(newSession);
    setSelectedSquare(null);
    setReplayedMove(null);
    setShowRestartDialog(false);
  };

  if (loading || gameState === null || session === null) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const inCheck = isInCheck(gameState, currentSide);
  const candidateUnderAttack = findKingCandidateUnderAttack(gameState, currentSide);
  const isCheckLike = inCheck || candidateUnderAttack !== null;
  const isOver = gameState.result.status !== "ongoing";

  const modeLabel: Record<GameMode, string> = {
    tablet: "Tablet",
    solo: "Solo",
    hotseat: "Hot-seat",
  };

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
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" justifyContent="center">
          <Typography variant="h5" fontWeight={700}>
            ♟ Pawn and Dude
          </Typography>
          <Chip label={modeLabel[mode]} size="small" variant="outlined" />
          {isOver ? (
            <Chip
              label={
                gameState.result.status === "win"
                  ? `${gameState.result.winner === "white" ? "White" : "Black"} wins!`
                  : "Draw"
              }
              color="success"
              size="small"
            />
          ) : (
            <Chip
              label={`${currentSide === "white" ? "White" : "Black"}'s turn`}
              color={currentSide === "white" ? "default" : "secondary"}
              size="small"
            />
          )}
          {isCheckLike && !isOver && (
            <Chip label="⚠ Check!" color="warning" size="small" />
          )}
        </Stack>

        {/* Board */}
        <Box
          sx={{
            transform: "none",
            transition: "transform 0.4s ease",
          }}
        >
          {renderingEngine.render({
            gameState,
            replayedMove,
            facePlayer,
            selectedSquare,
            legalDestinations,
            onSquareClick: handleSquareClick,
          })}
        </Box>

        {/* Controls */}
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" size="small" onClick={() => navigate({ to: "/" })}>
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

        {/* Move count */}
        <Typography variant="caption" color="text.secondary">
          Move {Math.floor(session.moves.length / 2) + 1} • Ply {session.moves.length}
        </Typography>
      </Box>

      {/* Onboarding tip dialog */}
      <Dialog open={showOnboarding} onClose={() => setShowOnboarding(false)} maxWidth="sm" fullWidth>
        <DialogTitle>How to play — Pawn and Dude</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              All non-pawn pieces start as <strong>Dudes</strong> (shown as ⬡) — pieces in superposition
              over the five standard types: Rook, Knight, Bishop, Queen, and King.
            </Typography>
            <Typography>
              When you move a dude, its type is narrowed to the pieces that could have made that move.
              A dude with only one possible type <strong>materializes</strong> into that piece.
            </Typography>
            <Typography>
              <strong>King rule:</strong> If all but one dude lack the ability to be a king, that dude
              immediately materializes as King.
            </Typography>
            <Typography>
              <strong>Queen rule:</strong> At most one queen per side. If a queen is captured, the
              queen candidate type becomes available again.
            </Typography>
            <Typography>
              <strong>Promotion:</strong> A pawn reaching the back rank promotes into a new Dude
              (not a chosen piece).
            </Typography>
            <Typography>
              <strong>Castling:</strong> Any unmoved back-rank dude that can still be a rook may
              partner with a king (or king-dude) for castling.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOnboarding(false)} variant="contained">
            Got it, let's play!
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restart confirmation */}
      <Dialog open={showRestartDialog} onClose={() => setShowRestartDialog(false)}>
        <DialogTitle>Restart game?</DialogTitle>
        <DialogContent>
          <Typography>All moves will be lost. The board will reset to the starting position.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRestartDialog(false)}>Cancel</Button>
          <Button onClick={handleRestart} color="warning" variant="contained">
            Restart
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejected move snackbar */}
      <Snackbar
        open={snackMessage !== null}
        autoHideDuration={2000}
        onClose={() => setSnackMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setSnackMessage(null)}>
          {snackMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
