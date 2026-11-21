import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { createApiHandler } from "./server/nasa-api.mjs"

/**
 * Mounts the shared NASA/agent API inside Vite itself. This removes browser
 * CORS problems and works in both `vite` and `vite preview` without a second
 * process. The standalone server/index.mjs uses the same handler.
 */
function spaceExplorerApi(mode: string): Plugin {
  const root = process.cwd()
  const env = loadEnv(mode, root, "") as Record<string, string | undefined>
  let handler: ReturnType<typeof createApiHandler> | null = null
  const getHandler = () => {
    handler ??= createApiHandler({ root, env })
    return handler
  }

  return {
    name: "space-explorer-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (await getHandler()(req, res)) return
        } catch (error) {
          console.error("[space-explorer-api]", error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: "internal api error" }))
          }
          return
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (await getHandler()(req, res)) return
        } catch (error) {
          console.error("[space-explorer-api]", error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: "internal api error" }))
          }
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), spaceExplorerApi(mode)],
  server: {
    host: true,
    port: 5175,
  },
  preview: {
    host: true,
    port: 5175,
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1800,
  },
}))
