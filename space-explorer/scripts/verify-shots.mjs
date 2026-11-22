/**
 * Headless visual QA for SPACE EXPLORER.
 *
 * 1. Zero-clutter canvas: no search bars, topic chips, checkbox panels or boxed ladders.
 * 2. Real physical distance and light-travel time at all six depths.
 * 3. Non-empty frames at every scale (particulate Milky Way, 3D cosmic web).
 * 4. On-demand NASA fact card on tap, dismissed by a scroll.
 * 5. No console errors, no WebGL context loss.
 */
import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import puppeteer from "puppeteer-core"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const shotsDir = join(root, ".shots")
mkdirSync(shotsDir, { recursive: true })

const PORT = 5199
const BASE = `http://localhost:${PORT}`

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ]
  for (const c of candidates) if (c && existsSync(c)) return c
  return null
}

const SCALES = [
  { name: "earth_surface", regime: "surface", unit: "km", region: "Earth" },
  { name: "earth_orbit", regime: "orbit", unit: "km", region: "Orbit" },
  { name: "solar_system", regime: "solar_system", unit: "AU", region: "Asteroid" },
  { name: "interstellar", regime: "interstellar", unit: "ly", region: "Centauri" },
  { name: "milky_way", regime: "milky_way", unit: "kly", region: "Milky" },
  { name: "observable_universe", regime: "universe", unit: "Bly", region: "Cosmic Web" },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Touch-driven QA on a phone viewport: the canvas must own single-finger orbit
 * and two-finger pinch (no page pan, no browser zoom), and no gesture may be
 * mistaken for a tap that opens the fact card.
 */
async function verifyMobile(browser, problems, consoleErrors) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  page.on("console", (msg) => {
    if (msg.type() !== "error") return
    const text = msg.text()
    if (!text.includes("favicon") && !text.includes("404")) consoleErrors.push(`[mobile] ${text}`)
  })
  page.on("pageerror", (err) => consoleErrors.push(`[mobile] ${String(err)}`))
  await page.goto(BASE, { waitUntil: "load", timeout: 120000 })
  await page.waitForFunction(() => Boolean(window.__engine), { timeout: 30000 })
  await sleep(2600)

  const client = await page.createCDPSession()
  const dispatch = (type, list) =>
    client.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: list.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 10, radiusY: 10, force: 1 })),
    })
  const pinch = async (from, to, steps = 10) => {
    await dispatch("touchStart", from)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      await dispatch("touchMove", from.map((p, k) => [p[0] + (to[k][0] - p[0]) * t, p[1] + (to[k][1] - p[1]) * t]))
      await sleep(16)
    }
    await dispatch("touchEnd", [])
    await sleep(420)
  }
  const state = () =>
    page.evaluate(() => ({
      ...window.__engine.getStats(),
      scale: window.visualViewport?.scale ?? 1,
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      factCard: Boolean(document.querySelector(".fact-card")),
    }))

  const start = await state()
  console.log(
    `[verify-mobile] launch: logDist=${start.logDist.toFixed(2)} yaw=${start.yaw.toFixed(2)} | ` +
      `readout ${(start.distanceM / 1000).toFixed(0)} km`,
  )
  // A portrait phone must frame the same regional map, not a blurry sliver.
  if (!(start.distanceM > 400_000)) {
    problems.push(`Mobile surface frames only ${(start.distanceM / 1000).toFixed(0)} km of ground`)
  }
  await page.screenshot({ path: join(shotsDir, "05_mobile_surface.png") })

  // 1. Pinch out on the canvas: zoom in, never browser-zoom or page-scroll.
  await pinch([[150, 620], [240, 620]], [[90, 620], [300, 620]])
  const zoomedIn = await state()
  console.log(`[verify-mobile] pinch out: logDist=${zoomedIn.logDist.toFixed(2)} scale=${zoomedIn.scale}`)
  if (!(zoomedIn.logDist < start.logDist - 0.2)) {
    problems.push(`Pinch-out did not zoom in (logDist ${start.logDist.toFixed(2)} -> ${zoomedIn.logDist.toFixed(2)})`)
  }
  if (!(zoomedIn.distanceM < start.distanceM)) {
    problems.push("Pinching in framed more ground instead of less")
  }
  if (zoomedIn.scale > 1.01) problems.push(`Pinch zoomed the page (visualViewport.scale=${zoomedIn.scale})`)
  if (zoomedIn.scrollY > 0) problems.push("Touch gesture scrolled the page")
  if (zoomedIn.factCard) problems.push("Pinch was treated as a tap and opened the fact card")

  // 2. Pinch in: zoom back out.
  await pinch([[100, 620], [290, 620]], [[165, 620], [225, 620]])
  const zoomedOut = await state()
  console.log(`[verify-mobile] pinch in: logDist=${zoomedOut.logDist.toFixed(2)}`)
  if (!(zoomedOut.logDist > zoomedIn.logDist + 0.2)) {
    problems.push(`Pinch-in did not zoom out (logDist ${zoomedIn.logDist.toFixed(2)} -> ${zoomedOut.logDist.toFixed(2)})`)
  }

  // 3. Single-finger drag orbits the camera and still never scrolls the page.
  await dispatch("touchStart", [[200, 700]])
  for (let i = 1; i <= 8; i++) {
    await dispatch("touchMove", [[200 + i * 9, 700]])
    await sleep(16)
  }
  await dispatch("touchEnd", [])
  await sleep(420)
  const dragged = await state()
  console.log(`[verify-mobile] drag: yaw=${dragged.yaw.toFixed(2)} scrollY=${dragged.scrollY}`)
  if (Math.abs(dragged.yaw - zoomedOut.yaw) < 0.05) problems.push("One-finger drag did not orbit the camera")
  if (dragged.scrollY > 0) problems.push("One-finger drag scrolled the page")
  if (dragged.factCard) problems.push("Drag was treated as a tap and opened the fact card")

  const hud = await page.evaluate(() => {
    const readout = document.querySelector(".top-readout")?.getBoundingClientRect()
    const scrubber = document.querySelector(".depth-scrubber")?.getBoundingClientRect()
    return { readoutRight: readout?.right ?? 0, scrubberLeft: scrubber?.left ?? 0, width: window.innerWidth }
  })
  if (hud.readoutRight > hud.scrubberLeft) problems.push("Mobile readout overlaps the depth scrubber")
  await page.screenshot({ path: join(shotsDir, "06_mobile_after_pinch.png") })
  await page.close()
}

async function main() {
  const chrome = findChrome()
  if (!chrome) {
    console.log("[verify-shots] Chrome not found - skipping (set CHROME_PATH).")
    return
  }

  const vite = spawn(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "preview", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: "pipe",
  })

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  })

  const consoleErrors = []
  const problems = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    page.on("console", (msg) => {
      if (msg.type() !== "error") return
      const text = msg.text()
      if (!text.includes("favicon") && !text.includes("404")) consoleErrors.push(text)
    })
    page.on("pageerror", (err) => consoleErrors.push(String(err)))

    await page.goto(BASE, { waitUntil: "load", timeout: 120000 })
    await page.waitForFunction(() => Boolean(window.__engine), { timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2500))

    // 1. No blocking HUD furniture of any kind.
    const obstacles = await page.evaluate(() => {
      const findings = []
      const selectors = [
        ".dock-input",
        ".dock-presets",
        ".layer-controls",
        ".scale-ladder",
        ".top-telemetry",
        ".compare-drawer",
        ".search-bar",
        ".hud-panel",
        "input",
      ]
      for (const selector of selectors) {
        if (document.querySelector(selector)) findings.push(`Unexpected ${selector} element`)
      }
      return findings
    })
    problems.push(...obstacles)

    await page.screenshot({ path: join(shotsDir, "01_earth_surface.png") })

    // 2. Each regime via the engine's own transition (smooth GSAP glide).
    for (const scale of SCALES) {
      await page.evaluate((regime) => window.__engine.setRegime(regime), scale.regime)
      await new Promise((r) => setTimeout(r, 2800))
      await page.screenshot({ path: join(shotsDir, `02_${scale.name}.png`) })

      const readout = await page.evaluate(() => {
        const region = document.querySelector(".top-readout-region")?.textContent?.trim() || ""
        const values = Array.from(document.querySelectorAll(".top-tele-value")).map(
          (el) => el.textContent?.trim() || "",
        )
        const stats = window.__engine.getStats()
        const signal = window.__engine.getFrameSignal()
        return { region, distance: values[0] || "", lightTime: values[1] || "", stats, signal }
      })

      console.log(
        `[verify-shots] ${scale.name}: "${readout.region}" | ${readout.distance} | ${readout.lightTime} | ` +
          `signal=${(readout.signal.nonBlack * 100).toFixed(2)}% mean=${readout.signal.mean.toFixed(2)} | ` +
          `labels=${readout.stats.labels} fps=${readout.stats.fps}`,
      )

      if (!readout.distance || readout.distance === "0 m") {
        problems.push(`Invalid distance readout at ${scale.name}: "${readout.distance}"`)
      }
      if (!readout.lightTime || readout.lightTime === "0 s") {
        problems.push(`Invalid light-time readout at ${scale.name}: "${readout.lightTime}"`)
      }
      if (scale.unit && !readout.distance.includes(scale.unit)) {
        problems.push(`${scale.name}: expected unit ${scale.unit} in "${readout.distance}"`)
      }
      if (scale.region && !readout.region.toLowerCase().includes(scale.region.toLowerCase())) {
        problems.push(`${scale.name}: unexpected region "${readout.region}"`)
      }
      if (readout.signal.nonBlack < 0.0015) {
        problems.push(`${scale.name}: frame looks empty (${(readout.signal.nonBlack * 100).toFixed(3)}%)`)
      }
    }

    // 2b. The surface readout must report the ground the launch frame shows.
    await page.evaluate(() => window.__engine.setRegime("surface"))
    await new Promise((r) => setTimeout(r, 2600))
    const surfaceReadout = await page.evaluate(() => {
      const stats = window.__engine.getStats()
      const plate = stats.surfacePlate
      const expected =
        plate &&
        ((2 * stats.cameraDistance * Math.tan((48 * Math.PI) / 360) * stats.aspect) / plate.widthUnits) *
          plate.widthM
      const shown = document.querySelector(".top-tele-value")?.textContent?.trim() || ""
      return { distanceM: stats.distanceM, expected, shown, logDist: stats.logDist, regime: stats.regime }
    })
    console.log(
      `[verify-shots] surface frame: shows "${surfaceReadout.shown}" | ` +
        `${(surfaceReadout.distanceM / 1000).toFixed(0)} km | expected ${(Number(surfaceReadout.expected) / 1000).toFixed(0)} km`,
    )
    if (!(surfaceReadout.distanceM > 1e5)) {
      problems.push(`Surface readout ${surfaceReadout.shown} does not reflect the framed ground`)
    }
    if (!surfaceReadout.expected || Math.abs(surfaceReadout.distanceM - surfaceReadout.expected) / surfaceReadout.expected > 0.03) {
      problems.push("Surface readout does not match the camera's framed ground width")
    }
    if (!surfaceReadout.shown.includes("km")) {
      problems.push(`Surface readout should be reported in km, got "${surfaceReadout.shown}"`)
    }

    // 3. Tap a celestial label to open the NASA fact sheet.
    const opened = await page.evaluate(() => {
      const label = document.querySelector(".scene-label:not(.is-hidden)")
      if (!label) return false
      label.click()
      return true
    })
    if (!opened) problems.push("No tappable scene label available")
    await new Promise((r) => setTimeout(r, 2200))
    const hasFactCard = await page.evaluate(() => Boolean(document.querySelector(".fact-card")))
    if (hasFactCard) {
      await page.screenshot({ path: join(shotsDir, "03_fact_card.png") })
      console.log("[verify-shots] NASA fact card rendered.")
    } else {
      problems.push("Fact card did not open on tap")
    }

    // 4. Dismiss the sheet and prove wheel zoom still works.
    await page.evaluate(() => {
      const canvas = document.querySelector(".scene-canvas canvas")
      canvas?.dispatchEvent(new WheelEvent("wheel", { deltaY: 240, bubbles: true }))
    })
    await new Promise((r) => setTimeout(r, 900))
    const dismissed = await page.evaluate(() => !document.querySelector(".fact-card"))
    if (!dismissed) problems.push("Fact card did not dismiss on scroll")
    await page.screenshot({ path: join(shotsDir, "04_wheel_scroll.png") })

    // 5. Full continuous wheel sweep: logDist must rise monotonically from the
    // Earth surface to the observable-universe limit with no dead zone.
    await page.evaluate(() => window.__engine.setRegime("surface"))
    await new Promise((r) => setTimeout(r, 2600))
    const sweep = await page.evaluate(async () => {
      const engine = window.__engine
      const canvas = document.querySelector(".scene-canvas canvas")
      const samples = [engine.getStats().logDist]
      for (let i = 0; i < 44; i++) {
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 360, bubbles: true }))
        await new Promise((resolve) => setTimeout(resolve, 90))
        samples.push(engine.getStats().logDist)
      }
      return { samples, finalLog: samples[samples.length - 1], regime: engine.getStats().regime }
    })
    let monotonic = true
    for (let i = 1; i < sweep.samples.length; i++) {
      if (sweep.samples[i] + 0.001 < sweep.samples[i - 1]) monotonic = false
    }
    console.log(
      `[verify-shots] full sweep: logDist ${sweep.samples[0].toFixed(2)} -> ${sweep.finalLog.toFixed(2)} | monotonic=${monotonic} | regime=${sweep.regime}`,
    )
    if (!monotonic) problems.push("Zoom sweep is not monotonic")
    if (sweep.finalLog < 25) problems.push(`Zoom sweep stalled at logDist ${sweep.finalLog.toFixed(2)}`)

    const stats = await page.evaluate(() => window.__engine.getStats())
    console.log(`[verify-shots] final stats: ${JSON.stringify(stats)}`)

    // 6. Phone viewport: touch orbit and pinch zoom.
    await verifyMobile(browser, problems, consoleErrors)
  } finally {
    await browser.close()
    vite.kill()
  }

  const allProblems = [...consoleErrors, ...problems]
  writeFileSync(
    join(shotsDir, "verify-report.json"),
    JSON.stringify({ problems: allProblems, ok: allProblems.length === 0 }, null, 2),
  )
  console.log(`[verify-shots] Finished with ${allProblems.length} problem(s).`)
  for (const p of allProblems) console.log("  -", p)
  process.exit(allProblems.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
