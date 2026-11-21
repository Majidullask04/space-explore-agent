/**
 * SPACE EXPLORER — Agentic Astrogation server.
 *
 * Exposes POST /api/agent. If an LLM provider is configured via env vars it
 * performs structured tool calling; otherwise it falls back to the exact same
 * deterministic intent-router the client uses, so the whole app works with no
 * API key at all.
 */
import http from "node:http"

const PORT = Number(process.env.PORT || 8787)

/* ------------------------------------------------------------------ */
/* Deterministic fallback (mirror of the client router)                */
/* ------------------------------------------------------------------ */
function fallbackPlan(query) {
  const q = String(query || "").toLowerCase()

  const mission = {
    "full journey": "full_journey",
    "tour the solar system": "solar_tour",
    "solar tour": "solar_tour",
    "nearest exoplanets": "nearest_exoplanets",
    "track live iss": "track_iss",
  }
  for (const [key, value] of Object.entries(mission)) {
    if (q.includes(key)) {
      return { steps: [{ tool: "run_mission_tour", args: { missionKey: value } }], fallback: true }
    }
  }

  const bodies = {
    sun: "solar_system",
    mercury: "solar_system",
    venus: "solar_system",
    mars: "solar_system",
    jupiter: "solar_system",
    saturn: "solar_system",
    uranus: "solar_system",
    neptune: "solar_system",
    pluto: "solar_system",
    moon: "earth_orbit",
    iss: "earth_orbit",
    andromeda: "observable_universe",
    laniakea: "observable_universe",
    sirius: "interstellar",
    betelgeuse: "interstellar",
  }

  if (q.includes("compare")) {
    const keys = Object.keys(bodies).filter((k) => q.includes(k))
    if (keys.length >= 2) {
      return {
        steps: [
          { tool: "compare_bodies", args: { a: keys[0], b: keys[1] } },
        ],
        fallback: true,
      }
    }
  }

  for (const [name, regime] of Object.entries(bodies)) {
    if (q.includes(name)) {
      return {
        steps: [
          { tool: "set_scale_regime", args: { regime } },
          { tool: "fly_to_target", args: { targetId: name, regime } },
        ],
        fallback: true,
      }
    }
  }

  const regimes = {
    orbit: "earth_orbit",
    "solar system": "solar_system",
    interstellar: "interstellar",
    "milky way": "milky_way",
    universe: "observable_universe",
  }
  for (const [key, value] of Object.entries(regimes)) {
    if (q.includes(key)) return { steps: [{ tool: "set_scale_regime", args: { regime: value } }], fallback: true }
  }

  return { steps: [], fallback: true }
}

/* ------------------------------------------------------------------ */
/* LLM provider (OpenAI-compatible + Gemini bridge)                    */
/* ------------------------------------------------------------------ */
async function callLLM(query, provider, apiKey, model) {
  const base = process.env.AGENT_BASE_URL || "https://api.openai.com/v1"
  const system = [
    "You are the astrogation pilot of a 3D space explorer.",
    "Your job: convert the user's journey request into a short, deterministic tool-call sequence.",
    "Tools: fly_to_target(targetId, regime), set_scale_regime(regime), run_mission_tour(missionKey), compare_bodies(a, b), fetch_live_iss(), set_time_warp(isoDate, speedMultiplier), toggle_layers(layer, value).",
    "Return compact JSON only: {\"narration\":\"...\",\"steps\":[{\"tool\":\"...\",\"args\":{}}]}",
    "Use real catalog ids: sun, mercury, venus, earth, mars, jupiter, saturn, uranus, neptune, pluto, moon, iss, alpha-centauri, proxima-centauri, barnard-star, sirius, epsilon-eridani, tau-ceti, trappist-1, kepler-186f, betelgeuse, sagittarius-a-star, orion-nebula, pillars-of-creation, crab-nebula, messier-13, andromeda, triangulum, virgo-supercluster, laniakea.",
    "Regimes: earth_map, earth_orbit, solar_system, interstellar, milky_way, observable_universe.",
  ].join("\n")

  let url = `${base}/chat/completions`
  let body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: query },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  }
  let headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }

  if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    body = { contents: [{ parts: [{ text: `${system}\n\nUser: ${query}\n\nReply with JSON only.` }] }] }
    headers = { "Content-Type": "application/json" }
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const json = await res.json()

  let text = ""
  if (provider === "gemini") {
    text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  } else {
    text = json?.choices?.[0]?.message?.content || ""
  }
  text = text.replace(/```json|```/g, "").trim()
  const parsed = JSON.parse(text)
  return { steps: parsed.steps || [], narration: parsed.narration || "", fallback: false }
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const keep = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
    res.end(JSON.stringify(obj))
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end()
    return
  }

  if (req.url === "/api/health") return keep(200, { ok: true, service: "space-explorer-agent" })
  if (req.url === "/api/agent" && req.method === "POST") {
    let raw = ""
    for await (const chunk of req) raw += chunk
    let body = {}
    try {
      body = JSON.parse(raw || "{}")
    } catch {
      return keep(400, { error: "invalid json" })
    }
    const query = body.query || ""

    const provider = process.env.AGENT_PROVIDER || process.env.VITE_AGENT_PROVIDER || ""
    const apiKey = process.env.AGENT_API_KEY || ""
    const model = process.env.AGENT_MODEL || process.env.VITE_AGENT_MODEL || "gpt-4o-mini"

    try {
      if (provider && apiKey) {
        const plan = await callLLM(query, provider, apiKey, model)
        return keep(200, plan)
      }
    } catch {
      // fall through to deterministic fallback on any LLM error
    }

    return keep(200, fallbackPlan(query))
  }

  return keep(404, { error: "not found" })
})

server.listen(PORT, () => {
  console.log(`[space-explorer-agent] listening on http://127.0.0.1:${PORT}`)
})
