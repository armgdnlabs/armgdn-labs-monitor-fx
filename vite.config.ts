import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build portable: dist/ works from any sub-path or static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 900 },
});
