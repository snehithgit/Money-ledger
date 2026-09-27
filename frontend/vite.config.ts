import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local development only: in production (the single-container Docker
// image, see /Dockerfile) FastAPI serves the built frontend itself, so
// there's no separate frontend server or proxy involved at all - this
// block only matters when running `npm run dev` against a backend
// started separately (e.g. `uvicorn app.main:app --reload` on :8000).
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
});
