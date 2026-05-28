import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env["BASE_PATH"] ?? "/",
  plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react()],
  resolve: {
    alias: {
      "@pwnd/core": new URL("../core/src/index.ts", import.meta.url).pathname,
    },
  },
});
