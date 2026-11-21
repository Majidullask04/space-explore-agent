import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/**
 * SPA dev config. Vite's built-in server.proxy forwards /api/* to the local
 * Express agent server (server/index.mjs) during development so the frontend
 * can call the AI agent without CORS issues. In production, /api/agent is
 * served by the deployed agent server (same-origin or via the host proxy).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5175,
    proxy: {
      "/api": {
        target: process.env.AGENT_PROXY || "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2023",
    chunkSizeWarningLimit: 1400,
  },
})
