import { defineConfig } from "vite";
import { offlineBuild } from "./scripts/offline-build.js";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss(), offlineBuild()],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
