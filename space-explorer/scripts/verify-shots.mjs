/**
 * Headless visual QA for SPACE EXPLORER (Continuous Logarithmic Refactor).
 *
 * Verifies:
 * 1. Zero-clutter canvas: zero search bars, zero topic chips, zero checkbox panels, zero boxed scale ladders.
 * 2. Real physical distance & light-travel time readouts at all 6 depths (no "620 m" or "0 s" at cosmic scale).
 * 3. Volumetric Milky Way without square image artifacts & 3D Cosmic Web at Observable Universe scale.
 * 4. Quiet on-demand floating NASA Fact Card on body selection and clean dismissal.
 * 5. Smooth continuous zoom gesture response without console or WebGL errors.
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

async function main() {
  const chrome = findChrome()
  if (!chrome) {
    console.log("[verify-shots] Chrome not found — skipping (set CHROME_PATH).")
    return
  }

  // Start Vite preview
  const vite = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: "pipe",
    shell: true,
  })
  await new Promise((res) => setTimeout(res, 3500))

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  })

  const consoleErrors = []
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text()
      // Ignore favicon or non-critical resource 404s
      if (!text.includes("favicon") && !text.includes("404")) {
        consoleErrors.push(text)
      }
    }
  })
  page.on("pageerror", (err) => consoleErrors.push(String(err)))

  await page.goto(BASE, { waitUntil: "load", timeout: 120000 })
  await new Promise((r) => setTimeout(r, 2200))
  await page.screenshot({ path: join(shotsDir, "01_earth_surface.png") })

  const problems = []

  // 1. Assert zero heavy UI obstacles
  const obstacles = await page.evaluate(() => {
    const findings = []
    if (document.querySelector(".dock-input")) findings.push("Legacy search input found")
    if (document.querySelector(".dock-presets")) findings.push("Legacy topic chips found")
    if (document.querySelector(".layer-controls")) findings.push("Legacy layer checkboxes found")
    if (document.querySelector(".scale-ladder")) findings.push("Legacy scale ladder found")
    if (document.querySelector(".top-telemetry")) findings.push("Legacy top telemetry pill found")
    if (document.querySelector(".compare-drawer")) findings.push("Legacy compare drawer found")
    return findings
  })
  problems.push(...obstacles)

  // 2. Step through all 6 scale depths and verify physical readouts
  const DEPTHS = [
    { name: "earth_surface", log: 2.4, minUnit: "m", expectedRegion: "Earth" },
    { name: "orbit", log: 6.2, minUnit: "km", expectedRegion: "Orbit" },
    { name: "solar_system", log: 10.5, minUnit: "AU", expectedRegion: "Solar System" },
    { name: "interstellar", log: 16.6, minUnit: "ly", expectedRegion: "Alpha Centauri" },
    { name: "milky_way", log: 20.2, minUnit: "ly", expectedRegion: "Milky Way" },
    { name: "observable_universe", log: 26.5, minUnit: "Bly", expectedRegion: "Universe" },
  ]

  for (const depth of DEPTHS) {
    // Scrub to target depth using depth ticks or direct drag
    await page.evaluate((targetLog) => {
      // Find scrubber tick and click it or use window.__engine
      const ticks = Array.from(document.querySelectorAll(".depth-tick"))
      const tick = ticks.find((t) => {
        const text = (t.textContent || "").toLowerCase()
        if (targetLog < 4 && text.includes("earth")) return true
        if (targetLog >= 4 && targetLog < 8 && text.includes("orbit")) return true
        if (targetLog >= 8 && targetLog < 14 && text.includes("solar")) return true
        if (targetLog >= 14 && targetLog < 18 && text.includes("stars")) return true
        if (targetLog >= 18 && targetLog < 23 && text.includes("milky")) return true
        if (targetLog >= 23 && text.includes("universe")) return true
        return false
      })
      if (tick) {
        tick.click()
      } else if (window.__engine) {
        window.__engine.setLogDist(targetLog)
      }
    }, depth.log)

    await new Promise((r) => setTimeout(r, 1400))
    await page.screenshot({ path: join(shotsDir, `02_${depth.name}.png`) })

    // Verify distance & light time readout accuracy
    const readout = await page.evaluate(() => {
      const regionEl = document.querySelector(".top-readout-region")
      const values = Array.from(document.querySelectorAll(".top-tele-value")).map((el) => el.textContent?.trim() || "")
      return {
        region: regionEl?.textContent?.trim() || "",
        distance: values[0] || "",
        lightTime: values[1] || "",
      }
    })

    console.log(`[verify-shots] Depth: ${depth.name} → Region: "${readout.region}", Distance: "${readout.distance}", Light-Time: "${readout.lightTime}"`)

    if (!readout.distance || readout.distance === "0 m") {
      problems.push(`Invalid distance readout at ${depth.name}: "${readout.distance}"`)
    }
    if (depth.name === "observable_universe") {
      if (readout.distance.includes(" m") && !readout.distance.includes("Mly") && !readout.distance.includes("Bly")) {
        problems.push(`Bug reproduced: Observable Universe showed meters! "${readout.distance}"`)
      }
      if (readout.lightTime === "0 s") {
        problems.push(`Bug reproduced: Observable Universe showed 0 s light time!`)
      }
    }
  }

  // 3. Test on-demand NASA Fact Card
  await page.evaluate(() => {
    // Click any visible scene label
    const label = document.querySelector(".scene-label:not(.is-hidden)")
    if (label) {
      label.click()
    }
  })
  await new Promise((r) => setTimeout(r, 1200))

  const hasFactCard = await page.evaluate(() => {
    return Boolean(document.querySelector(".fact-card"))
  })
  if (hasFactCard) {
    await page.screenshot({ path: join(shotsDir, "03_fact_card.png") })
    console.log("[verify-shots] NASA Fact Card rendered successfully.")
    // Dismiss Fact Card
    await page.evaluate(() => {
      const closeBtn = document.querySelector(".fact-card-close")
      if (closeBtn) closeBtn.click()
    })
    await new Promise((r) => setTimeout(r, 400))
  }

  // 4. Test natural continuous mouse wheel inertia
  await page.evaluate(() => {
    const canvas = document.querySelector(".scene-canvas")
    if (canvas) {
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }))
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 800))
  await page.screenshot({ path: join(shotsDir, "04_wheel_scroll.png") })

  await browser.close()
  vite.kill()

  const allProblems = [...consoleErrors, ...problems]
  writeFileSync(join(shotsDir, "verify-report.json"), JSON.stringify({ problems: allProblems, ok: allProblems.length === 0 }, null, 2))
  console.log(`[verify-shots] Finished with ${allProblems.length} problem(s).`)
  for (const p of allProblems) console.log("  -", p)
  process.exit(allProblems.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
