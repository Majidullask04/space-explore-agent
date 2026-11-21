/**
 * Optional standalone API server. Vite already mounts the same middleware in
 * dev and preview, so this is only needed when serving the built app behind a
 * separate host.
 */
import http from "node:http"
import { createApiHandler, loadEnv } from "./nasa-api.mjs"

const PORT = Number(process.env.PORT || 8787)
const env = loadEnv(process.cwd())
const handleApi = createApiHandler({ root: process.cwd(), env })

const server = http.createServer(async (req, res) => {
  const handled = await handleApi(req, res)
  if (!handled) {
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "not found" }))
  }
})

server.listen(PORT, () => {
  console.log(`[space-explorer-api] http://127.0.0.1:${PORT}`)
  console.log(
    `[space-explorer-api] NASA key: ${env.NASA_API_KEY ? "configured" : "DEMO_KEY fallback"}`,
  )
})
