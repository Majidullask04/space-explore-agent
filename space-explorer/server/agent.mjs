/**
 * Optional LLM bridge for the Space Agent.
 *
 * The browser always ships a complete deterministic intent router, so this
 * endpoint is an enhancement, not a dependency. When AGENT_PROVIDER and
 * AGENT_API_KEY are configured, the model receives strict tool definitions
 * and returns a validated flight plan. Otherwise it reports configured:false
 * and the client runs locally.
 */

const TOOL_DEFS = [
  {
    name: "locate_user_origin",
    description: "Re-read the user's saved or geolocated origin on Earth.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fly_to_target",
    description:
      "Fly the camera to a real catalog body and open its NASA science dossier. Use catalog ids such as mars, saturn, iss, jwst, proxima-centauri, trappist-1e, sagittarius-a-star, orion-nebula, andromeda, cmb-horizon.",
    parameters: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "Catalog id of the destination." },
        regime: {
          type: "string",
          enum: ["surface", "orbit", "solar_system", "interstellar", "milky_way", "universe"],
        },
      },
      required: ["targetId", "regime"],
    },
  },
  {
    name: "set_scale_regime",
    description: "Change the scale regime without selecting a specific body.",
    parameters: {
      type: "object",
      properties: {
        regime: {
          type: "string",
          enum: ["surface", "orbit", "solar_system", "interstellar", "milky_way", "universe"],
        },
      },
      required: ["regime"],
    },
  },
  {
    name: "run_mission_tour",
    description: "Run a multi-stop cinematic tour.",
    parameters: {
      type: "object",
      properties: {
        missionKey: {
          type: "string",
          enum: [
            "full_journey",
            "solar_tour",
            "earth_to_mars",
            "interstellar",
            "galaxy",
            "universe",
            "live_iss",
            "habitable_worlds",
          ],
        },
      },
      required: ["missionKey"],
    },
  },
  {
    name: "set_time_warp",
    description:
      "Set the simulation clock. Speeds are expressed as simulation time per real second.",
    parameters: {
      type: "object",
      properties: {
        isoDate: { type: "string", description: "Optional ISO date, e.g. 2030-01-01." },
        speed: {
          type: "string",
          enum: ["realtime", "1hour/s", "1day/s", "1week/s", "1month/s", "1year/s"],
        },
      },
      required: ["speed"],
    },
  },
  {
    name: "fetch_nasa_media",
    description: "Fetch real NASA Images API results for a query and open the gallery.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "fetch_live_space_weather",
    description: "Fetch active solar flares from NASA DONKI and open the Sun dossier.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fetch_today_asteroids",
    description: "Fetch near-Earth asteroids from NASA NeoWs for today.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "compare_bodies",
    description: "Open a physical comparison between two catalog bodies.",
    parameters: {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "toggle_layers",
    description: "Toggle or set a visual layer.",
    parameters: {
      type: "object",
      properties: {
        layer: {
          type: "string",
          enum: ["orbits", "labels", "constellations", "spacecraft", "belts", "grid"],
        },
        value: { type: "boolean" },
      },
      required: ["layer"],
    },
  },
]

const SYSTEM = `You are the astrogation pilot and NASA mission scientist for a real-time 3D space explorer.
Convert the user's request into a short sequence of tool calls. Prefer direct flights over long tours.
Use only these real catalog ids: sun, mercury, venus, earth, moon, mars, jupiter, io, europa, ganymede, callisto, saturn, titan, enceladus, uranus, neptune, triton, pluto, charon, ceres, asteroid-belt, kuiper-belt, iss, jwst, voyager-1, voyager-2, parker-solar-probe, juno, new-horizons, proxima-centauri, proxima-b, alpha-centauri, barnard-star, sirius, tau-ceti, trappist-1, trappist-1e, kepler-186f, k2-18b, toi-700d, betelgeuse, vega, arcturus, rigel, polaris, sagittarius-a-star, orion-arm, orion-nebula, eagle-nebula, crab-nebula, carina-nebula, lagoon-nebula, ring-nebula, helix-nebula, andromeda, triangulum, lmc, smc, virgo-cluster, coma-cluster, laniakea, great-attractor, local-group, cosmic-web, cmb-horizon.
Regimes are surface, orbit, solar_system, interstellar, milky_way, universe.
If the user asks for NASA photographs, call fetch_nasa_media with a specific query.
If they ask about solar weather, call fetch_live_space_weather. If they ask about asteroids today, call fetch_today_asteroids.
Narration must be scientifically accurate, concise, and contain no emojis. Mention that distances and light travel times are computed live by the interface when relevant.
Never invent facts, mission names, or coordinates.`;

function agentConfig(env) {
  const provider = String(env.AGENT_PROVIDER || "").toLowerCase().trim()
  const apiKey = env.AGENT_API_KEY || env.OPENAI_API_KEY || ""
  const model = env.AGENT_MODEL || (provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini")
  return {
    provider,
    apiKey,
    model,
    baseUrl: env.AGENT_BASE_URL || "https://api.openai.com/v1",
    configured: Boolean(provider && apiKey),
  }
}

export function agentStatus(env = process.env) {
  const cfg = agentConfig(env)
  return {
    configured: cfg.configured,
    provider: cfg.configured ? cfg.provider : null,
    model: cfg.configured ? cfg.model : null,
  }
}

function normalizeSteps(raw) {
  if (!Array.isArray(raw)) return []
  const valid = new Set(TOOL_DEFS.map((t) => t.name))
  return raw
    .filter((s) => s && valid.has(String(s.tool || s.name)))
    .slice(0, 8)
    .map((s) => ({
      tool: String(s.tool || s.name),
      args: s.args && typeof s.args === "object" ? s.args : {},
    }))
}

async function callOpenAI(cfg, query) {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: query },
      ],
      tools: TOOL_DEFS.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const json = await res.json()
  const message = json?.choices?.[0]?.message || {}
  const steps = normalizeSteps(
    (message.tool_calls || []).map((call) => {
      let args = {}
      try {
        args = JSON.parse(call.function?.arguments || "{}")
      } catch {
        args = {}
      }
      return { tool: call.function?.name, args }
    }),
  )
  return { steps, narration: String(message.content || "").trim() }
}

async function callGemini(cfg, query) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: query }] }],
      tools: [{ functionDeclarations: TOOL_DEFS }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts || []
  const steps = normalizeSteps(
    parts.filter((p) => p.functionCall).map((p) => ({ tool: p.functionCall.name, args: p.functionCall.args })),
  )
  const narration = parts
    .filter((p) => typeof p.text === "string")
    .map((p) => p.text)
    .join(" ")
    .trim()
  return { steps, narration }
}

async function readBody(req) {
  let raw = ""
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 64_000) throw new Error("request too large")
  }
  return raw
}

export async function handleAgentRequest(req, res, env) {
  const cfg = agentConfig(env)
  const send = (code, obj) => {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    })
    res.end(JSON.stringify(obj))
  }

  if (!cfg.configured) {
    send(200, {
      configured: false,
      steps: [],
      narration: "",
      note: "No LLM key configured. The deterministic client router is active.",
    })
    return
  }

  let body = {}
  try {
    body = JSON.parse((await readBody(req)) || "{}")
  } catch {
    send(400, { error: "invalid json" })
    return
  }
  const query = String(body.query || "").slice(0, 2000)
  if (!query.trim()) {
    send(400, { error: "query required" })
    return
  }

  try {
    const result =
      cfg.provider === "gemini" ? await callGemini(cfg, query) : await callOpenAI(cfg, query)
    send(200, {
      configured: true,
      provider: cfg.provider,
      model: cfg.model,
      steps: result.steps,
      narration: result.narration,
    })
  } catch (error) {
    send(200, {
      configured: true,
      provider: cfg.provider,
      model: cfg.model,
      steps: [],
      narration: "",
      error: String(error?.message || error),
    })
  }
}
