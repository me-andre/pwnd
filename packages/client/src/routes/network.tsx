import { Box, Button, Container, Typography } from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/network")({
  component: NetworkPage,
});

function NetworkPage() {
  const navigate = useNavigate();
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h3" fontWeight={700}>
          🚧 Not Implemented Yet
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Online network play is planned for a future release. For now, enjoy the local modes!
        </Typography>
        <Button variant="contained" onClick={() => navigate({ to: "/" })}>
          ← Back to Menu
        </Button>
      </Box>
    </Container>
  );
}
