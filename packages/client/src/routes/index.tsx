import { Box, Button, Container, Divider, Stack, Tooltip, Typography } from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { v4 as uuidv4 } from "uuid";
import { LocalStorageTransport } from "../transport/LocalStorageTransport.js";
import type { GameMode } from "../transport/Transport.js";

export const Route = createFileRoute("/")({
  component: MainMenu,
});

const transport = new LocalStorageTransport();

function MainMenu() {
  const navigate = useNavigate();

  const startGame = async (mode: GameMode) => {
    const gameId = uuidv4();
    await transport.saveSession({
      gameId,
      mode,
      createdAt: new Date().toISOString(),
      moves: [],
    });
    await navigate({ to: "/game/$gameId", params: { gameId }, search: { mode } });
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          py: 4,
        }}
      >
        <Box textAlign="center">
          <Typography variant="h2" fontWeight={700} gutterBottom>
            ♟ Pawn and Dude
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 400 }}>
            A chess variant where all non-pawn pieces start as undefined "dudes" in superposition.
            They reveal their true identity through movement.
          </Typography>
        </Box>

        <Stack spacing={2} width="100%">
          <Tooltip
            title="Both players share the same device, board flips between turns"
            placement="right"
          >
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => startGame("hotseat")}
              sx={{ py: 1.5, fontSize: "1.1rem" }}
            >
              Hot-seat (2 players, 1 device)
            </Button>
          </Tooltip>

          <Tooltip
            title="Board always faces the same direction — play on a tablet laid flat"
            placement="right"
          >
            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={() => startGame("tablet")}
              sx={{ py: 1.5, fontSize: "1.1rem" }}
            >
              Tablet mode (both sides, no rotation)
            </Button>
          </Tooltip>

          <Tooltip
            title="Single player — board rotates so your pieces always face you"
            placement="right"
          >
            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={() => startGame("solo")}
              sx={{ py: 1.5, fontSize: "1.1rem" }}
            >
              Solo (vs. yourself, rotating)
            </Button>
          </Tooltip>

          <Divider />

          <Tooltip title="Online multiplayer coming soon" placement="right">
            <span>
              <Button
                variant="text"
                size="large"
                fullWidth
                onClick={() => navigate({ to: "/network" })}
                sx={{ py: 1.5, fontSize: "1.1rem", color: "text.disabled" }}
              >
                Over the network (coming soon)
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Container>
  );
}
