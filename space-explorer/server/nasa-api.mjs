/**
 * Shared NASA + agent API middleware.
 *
 * Used by both the Vite dev/preview server and the optional standalone Node
 * server. It keeps upstream keys off the client, normalises every payload,
 * and caches responses in memory and on disk so the interface stays useful
 * when NASA rate-limits or the network drops.
 */
import { createHash } from "node:crypto"
import { promises as fs, readFileSync } from "node:fs"
import path from "node:path"
import { handleAgentRequest, agentStatus } from "./agent.mjs"

const DEFAULT_TTL = {
  iss: 4_000,
  flares: 30 * 60_000,
  asteroids: 6 * 60 * 60_000,
  exoplanets: 24 * 60 * 60_000,
  images: 24 * 60 * 60_000,
  horizons: 6 * 60 * 60_000,
  gibs: 7 * 24 * 60 * 60_000,
}

const memory = new Map()

function sha1(value) {
  return createHash("sha1").update(value).digest("hex")
}

export function loadEnv(root = process.cwd()) {
  const env = { ...process.env }
  try {
    const text = requireEnvFile(path.join(root, ".env"))
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let value = m[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(m[1] in env)) env[m[1]] = value
    }
  } catch {
    // .env is optional
  }
  return env
}

function requireEnvFile(file) {
  return readFileSync(file, "utf8")
}

function nasaKey(env) {
  return env.NASA_API_KEY || env.VITE_NASA_API_KEY || "DEMO_KEY"
}

function cacheDir(root) {
  return path.join(root, ".cache", "nasa")
}

async function readCache(root, key, allowStale = false) {
  const mem = memory.get(key)
  if (mem && (allowStale || mem.expires > Date.now())) return mem.value
  try {
    const file = path.join(cacheDir(root), `${key}.json`)
    const raw = await fs.readFile(file, "utf8")
    const parsed = JSON.parse(raw)
    if (allowStale || parsed.expires > Date.now()) {
      memory.set(key, parsed)
      return parsed.value
    }
  } catch {
    // miss
  }
  return null
}

async function writeCache(root, key, value, ttl) {
  const record = { expires: Date.now() + ttl, value }
  memory.set(key, record)
  try {
    await fs.mkdir(cacheDir(root), { recursive: true })
    await fs.writeFile(path.join(cacheDir(root), `${key}.json`), JSON.stringify(record))
  } catch {
    // disk cache is best-effort
  }
}

async function readBinaryCache(root, key, allowStale = false) {
  const mem = memory.get(key)
  if (mem && (allowStale || mem.expires > Date.now())) return mem.value
  try {
    const meta = JSON.parse(await fs.readFile(path.join(cacheDir(root), `${key}.meta.json`), "utf8"))
    if (allowStale || meta.expires > Date.now()) {
      const body = await fs.readFile(path.join(cacheDir(root), `${key}.bin`))
      const value = { body, type: meta.type }
      memory.set(key, { expires: meta.expires, value })
      return value
    }
  } catch {
    // miss
  }
  return null
}

async function writeBinaryCache(root, key, value, ttl) {
  const expires = Date.now() + ttl
  memory.set(key, { expires, value })
  try {
    await fs.mkdir(cacheDir(root), { recursive: true })
    await fs.writeFile(path.join(cacheDir(root), `${key}.bin`), value.body)
    await fs.writeFile(
      path.join(cacheDir(root), `${key}.meta.json`),
      JSON.stringify({ expires, type: value.type }),
    )
  } catch {
    // best-effort
  }
}

function sendJson(res, code, obj, cache = "no-store") {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cache,
    "Access-Control-Allow-Origin": "*",
  })
  res.end(body)
}

async function fetchJson(url, timeoutMs = 14_000) {
  const res = await fetch(url, {
    headers: { "User-Agent": "space-explorer/1.0 (NASA Eyes inspired)" },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return res.json()
}

function clampNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/* ------------------------------------------------------------------ */
/* Upstream adapters                                                   */
/* ------------------------------------------------------------------ */

async function getIss(env, root) {
  const key = "iss-v1"
  const cached = await readCache(root, key)
  if (cached) return cached
  try {
    const json = await fetchJson("https://api.wheretheiss.at/v1/satellites/25544", 10_000)
    const value = {
      lat: clampNumber(json.latitude),
      lng: clampNumber(json.longitude),
      altitudeKm: clampNumber(json.altitude, 420),
      velocityKmH: clampNumber(json.velocity, 27600),
      visibility: String(json.visibility || "unknown"),
      solarLat: clampNumber(json.solar_lat),
      solarLng: clampNumber(json.solar_lon),
      timestamp: clampNumber(json.timestamp, Date.now() / 1000) * 1000,
      source: "live",
    }
    await writeCache(root, key, value, DEFAULT_TTL.iss)
    return value
  } catch (error) {
    const stale = await readCache(root, key, true)
    if (stale) return { ...stale, source: "cached" }
    throw error
  }
}

async function getFlares(env, root) {
  const key = "flares-v1"
  const cached = await readCache(root, key)
  if (cached) return cached
  try {
    const end = new Date()
    const start = new Date(end.getTime() - 60 * 86400000)
    const url = `https://api.nasa.gov/DONKI/FLR?startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}&api_key=${encodeURIComponent(nasaKey(env))}`
    const json = await fetchJson(url, 18_000)
    const rows = Array.isArray(json) ? json : []
    const value = rows
      .map((f) => ({
        id: String(f.flrID || `${f.beginTime}-${f.classType}`),
        begin: f.beginTime || "",
        peak: f.peakTime || "",
        end: f.endTime || "",
        classType: f.classType || "—",
        sourceLocation: f.sourceLocation || "",
        activeRegion: f.activeRegionNum ? `AR${f.activeRegionNum}` : "",
        link: f.link || "",
        source: "live",
      }))
      .sort((a, b) => String(b.begin).localeCompare(String(a.begin)))
      .slice(0, 12)
    await writeCache(root, key, value, DEFAULT_TTL.flares)
    return value
  } catch (error) {
    const stale = await readCache(root, key, true)
    if (stale) return stale.map((f) => ({ ...f, source: "cached" }))
    throw error
  }
}

async function getAsteroids(env, root) {
  const key = "asteroids-v1"
  const cached = await readCache(root, key)
  if (cached) return cached
  try {
    const today = new Date().toISOString().slice(0, 10)
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${encodeURIComponent(nasaKey(env))}`
    const json = await fetchJson(url, 18_000)
    const rows = json?.near_earth_objects?.[today] || []
    const value = rows
      .map((a) => {
        const ca = a.close_approach_data?.[0] || {}
        return {
          id: String(a.id || a.name),
          name: String(a.name || "Unknown"),
          closeApproach: String(ca.close_approach_date_full || ca.close_approach_date || today),
          missKm: clampNumber(ca.miss_distance?.kilometers),
          missLunar: clampNumber(ca.miss_distance?.lunar),
          velocityKmH: clampNumber(ca.relative_velocity?.kilometers_per_hour),
          diameterMinM: clampNumber(a.estimated_diameter?.meters?.estimated_diameter_min),
          diameterMaxM: clampNumber(a.estimated_diameter?.meters?.estimated_diameter_max),
          hazardous: Boolean(a.is_potentially_hazardous_asteroid),
          source: "live",
        }
      })
      .sort((a, b) => a.missKm - b.missKm)
      .slice(0, 16)
    await writeCache(root, key, value, DEFAULT_TTL.asteroids)
    return value
  } catch (error) {
    const stale = await readCache(root, key, true)
    if (stale) return stale.map((a) => ({ ...a, source: "cached" }))
    throw error
  }
}

async function getExoplanets(env, root, limit) {
  const key = `exoplanets-v1-${limit}`
  const cached = await readCache(root, key)
  if (cached) return cached
  try {
    const query = `select top ${limit} pl_name,hostname,ra,dec,sy_dist,pl_rade,pl_bmasse,pl_eqt,pl_orbper,disc_year,disc_facility,discoverymethod,sy_snum,sy_pnum from pscomppars where default_flag=1 and sy_dist is not null and sy_dist < 250 order by sy_dist asc`
    const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(query)}&format=json`
    const json = await fetchJson(url, 22_000)
    const value = (Array.isArray(json) ? json : [])
      .filter((r) => r.pl_name && r.hostname)
      .map((r) => ({
        name: String(r.pl_name),
        host: String(r.hostname),
        raDeg: clampNumber(r.ra),
        decDeg: clampNumber(r.dec),
        distPc: clampNumber(r.sy_dist),
        radiusEarth: r.pl_rade == null ? undefined : clampNumber(r.pl_rade),
        massEarth: r.pl_bmasse == null ? undefined : clampNumber(r.pl_bmasse),
        eqTempK: r.pl_eqt == null ? undefined : clampNumber(r.pl_eqt),
        periodDays: r.pl_orbper == null ? undefined : clampNumber(r.pl_orbper),
        discoveryYear: r.disc_year == null ? undefined : clampNumber(r.disc_year),
        facility: r.disc_facility || "",
        method: r.discoverymethod || "",
        stars: r.sy_snum == null ? undefined : clampNumber(r.sy_snum),
        planets: r.sy_pnum == null ? undefined : clampNumber(r.sy_pnum),
      }))
    await writeCache(root, key, value, DEFAULT_TTL.exoplanets)
    return value
  } catch (error) {
    const stale = await readCache(root, key, true)
    if (stale) return stale
    throw error
  }
}

async function getImages(env, root, query, limit) {
  const key = `images-v1-${sha1(query).slice(0, 12)}-${limit}`
  const cached = await readCache(root, key)
  if (cached) return cached
  try {
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${limit}`
    const json = await fetchJson(url, 18_000)
    const items = json?.collection?.items || []
    const value = items
      .map((item) => {
        const d = item.data?.[0] || {}
        const link = item.links?.[0]?.href || ""
        if (!link) return null
        return {
          id: String(d.nasa_id || link),
          title: String(d.title || "NASA image"),
          date: String(d.date_created || "").slice(0, 10),
          center: String(d.center || "NASA"),
          caption: String(d.description || "").replace(/\s+/g, " ").slice(0, 520),
          thumb: link,
          full: link,
          source: "live",
        }
      })
      .filter(Boolean)
      .slice(0, limit)
    await writeCache(root, key, value, DEFAULT_TTL.images)
    return value
  } catch (error) {
    const stale = await readCache(root, key, true)
    if (stale) return stale.map((i) => ({ ...i, source: "cached" }))
    throw error
  }
}

const HORIZONS_IDS = {
  mercury: "199",
  venus: "299",
  earth: "399",
  mars: "499",
  jupiter: "599",
  saturn: "699",
  uranus: "799",
  neptune: "899",
  pluto: "999",
}

async function getHorizons(env, root, body) {
  const id = HORIZONS_IDS[body]
  if (!id) throw new Error("unknown body")
  const key = `horizons-v1-${body}`
  const cached = await readCache(root, key)
  if (cached) return cached
  try {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const params = new URLSearchParams({
      format: "text",
      COMMAND: `'${id}'`,
      OBJ_DATA: "'NO'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'VECTORS'",
      CENTER: "'500@10'",
      REF_PLANE: "'ECLIPTIC'",
      START_TIME: `'${today}'`,
      STOP_TIME: `'${tomorrow}'`,
      STEP_SIZE: "'1 d'",
      VEC_TABLE: "'2'",
      OUT_UNITS: "'AU-D'",
      CSV_FORMAT: "'YES'",
    })
    const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`, {
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`horizons ${res.status}`)
    const text = await res.text()
    const block = text.split("$$SOE")[1]?.split("$$EOE")[0]?.trim()
    if (!block) throw new Error("horizons empty")
    const cols = block.split("\n")[0].split(",").map((c) => c.trim())
    const value = {
      body,
      date: cols[1] || today,
      x: Number(cols[2]),
      y: Number(cols[3]),
      z: Number(cols[4]),
      source: "live",
    }
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
      throw new Error("horizons parse")
    }
    await writeCache(root, key, value, DEFAULT_TTL.horizons)
    return value
  } catch (error) {
    const stale = await readCache(root, key, true)
    if (stale) return { ...stale, source: "cached" }
    throw error
  }
}

const GIBS_LAYERS = {
  BlueMarble_ShadedRelief_Bathymetry: "GoogleMapsCompatible_Level8",
  BlueMarble_NextGeneration: "GoogleMapsCompatible_Level8",
  VIIRS_SNPP_CorrectedReflectance_TrueColor: "GoogleMapsCompatible_Level9",
}

async function getGibs(env, root, layer, z, x, y) {
  const matrix = GIBS_LAYERS[layer]
  if (!matrix) throw new Error("unknown layer")
  if (z < 0 || z > 8) throw new Error("zoom out of range")
  const max = 2 ** z
  if (x < 0 || y < 0 || x >= max || y >= max) throw new Error("tile out of range")
  const key = `gibs-v1-${sha1(`${layer}/${z}/${x}/${y}`).slice(0, 16)}`
  const cached = await readBinaryCache(root, key)
  if (cached) return cached
  const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${matrix}/${z}/${y}/${x}.jpeg`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`gibs ${res.status}`)
  const body = Buffer.from(await res.arrayBuffer())
  const value = { body, type: "image/jpeg" }
  await writeBinaryCache(root, key, value, DEFAULT_TTL.gibs)
  return value
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const ISS_FALLBACK = {
  lat: 23.18,
  lng: 78.94,
  altitudeKm: 421.3,
  velocityKmH: 27600,
  visibility: "daylight",
  solarLat: 20.1,
  solarLng: 79.4,
  timestamp: 0,
  source: "cached",
}

/**
 * NASA upstreams are rate limited and occasionally return 5xx. The client has
 * verified snapshot fallbacks, so a failed upstream must degrade to an empty
 * payload with HTTP 200 rather than surfacing a console error for every view.
 */
async function safeData(loader, fallback) {
  try {
    return await loader()
  } catch (error) {
    console.warn("[space-explorer-api] upstream unavailable:", error?.message || error)
    return typeof fallback === "function" ? fallback() : fallback
  }
}

export function createApiHandler(options = {}) {
  const root = options.root || process.cwd()
  const env = options.env || loadEnv(root)

  return async function handleApi(req, res) {
    const url = new URL(req.url || "/", "http://localhost")
    if (!url.pathname.startsWith("/api/")) return false

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      })
      res.end()
      return true
    }

    try {
      if (url.pathname === "/api/health") {
        sendJson(res, 200, {
          ok: true,
          service: "space-explorer",
          nasaKey: Boolean(nasaKey(env)),
          agent: agentStatus(env).configured,
        })
        return true
      }

      if (url.pathname === "/api/agent/status") {
        sendJson(res, 200, agentStatus(env))
        return true
      }

      if (url.pathname === "/api/agent" && req.method === "POST") {
        await handleAgentRequest(req, res, env)
        return true
      }

      if (url.pathname === "/api/nasa/iss") {
        sendJson(res, 200, await safeData(() => getIss(env, root), ISS_FALLBACK), "public, max-age=4")
        return true
      }

      if (url.pathname === "/api/nasa/flares") {
        sendJson(res, 200, await safeData(() => getFlares(env, root), []), "public, max-age=300")
        return true
      }

      if (url.pathname === "/api/nasa/asteroids") {
        sendJson(res, 200, await safeData(() => getAsteroids(env, root), []), "public, max-age=900")
        return true
      }

      if (url.pathname === "/api/nasa/exoplanets") {
        const limit = Math.min(800, Math.max(10, Number(url.searchParams.get("limit") || 400)))
        sendJson(
          res,
          200,
          await safeData(() => getExoplanets(env, root, limit), []),
          "public, max-age=3600",
        )
        return true
      }

      if (url.pathname === "/api/nasa/images") {
        const q = (url.searchParams.get("q") || "Earth").slice(0, 120)
        const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") || 6)))
        sendJson(
          res,
          200,
          await safeData(() => getImages(env, root, q, limit), []),
          "public, max-age=3600",
        )
        return true
      }

      if (url.pathname === "/api/nasa/horizons") {
        const body = (url.searchParams.get("body") || "mars").toLowerCase()
        sendJson(
          res,
          200,
          await safeData(() => getHorizons(env, root, body), null),
          "public, max-age=3600",
        )
        return true
      }

      if (url.pathname === "/api/nasa/gibs") {
        const layer = url.searchParams.get("layer") || "BlueMarble_ShadedRelief_Bathymetry"
        const z = Number(url.searchParams.get("z") || 6)
        const x = Number(url.searchParams.get("x") || 0)
        const y = Number(url.searchParams.get("y") || 0)
        const tile = await getGibs(env, root, layer, z, x, y)
        res.writeHead(200, {
          "Content-Type": tile.type,
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*",
        })
        res.end(tile.body)
        return true
      }

      sendJson(res, 404, { error: "not found" })
      return true
    } catch (error) {
      sendJson(res, 502, { error: String(error?.message || error) })
      return true
    }
  }
}
