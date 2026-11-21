/**
 * Headless visual QA for SPACE EXPLORER.
 *
 * Boots the Vite dev server, opens the app in headless Chromium, steps
 * through all six scale regimes, and asserts there are no console errors,
 * no WebGL crashes, and no overlapping HUD panels. Writes screenshots into
 * .shots/ (matching the cosmos/.shots pattern).
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
  await new Promise((res) => setTimeout(res, 10000))

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  })

  const consoleErrors = []
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => consoleErrors.push(String(err)))

  await page.goto(BASE, { waitUntil: "load", timeout: 120000 })
  await new Promise((r) => setTimeout(r, 2200))
  await page.screenshot({ path: join(shotsDir, "earth_map.png") })

  // Six regimes in order: surface, orbit, solar_system, interstellar, milky_way, universe
  const regimes = ["surface", "orbit", "solar_system", "interstellar", "milky_way", "universe"]
  for (const regime of regimes) {
    // Click the corresponding ladder rung
    const clicked = await page.evaluate((r) => {
      const btns = Array.from(document.querySelectorAll(".ladder-rung"))
      const target = btns.find((b) => b.textContent.toLowerCase().includes(r.replaceAll("_", " ")))
      if (target) {
        target.click()
        return true
      }
      return false
    }, regime)
    if (!clicked) consoleErrors.push(`No ladder rung for ${regime}`)
    await new Promise((r) => setTimeout(r, 1200))
    await page.screenshot({ path: join(shotsDir, `${regime}.png`) })
  }

  // Trigger an agent mission and capture state
  await page.evaluate(() => {
    const input = document.querySelector(".dock-input")
    if (input) {
      input.value = "fly to Saturn"
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    const send = document.querySelector(".dock-send")
    send?.click()
  })
  await new Promise((r) => setTimeout(r, 1600))
  await page.screenshot({ path: join(shotsDir, "agent-mission.png") })

  // Overlap check: sample HUD panel geometry for intersections
  const overlap = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll(".hud-panel")).map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height, cls: el.className }
    })
    const issues = []
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
        if (overlapX > 20 && overlapY > 20) {
          issues.push(`${a.cls} ↔ ${b.cls}`)
        }
      }
    }
    return issues
  })

  await browser.close()
  vite.kill()

  const problems = [...consoleErrors, ...overlap]
  writeFileSync(join(shotsDir, "verify-report.json"), JSON.stringify({ problems, ok: problems.length === 0 }, null, 2))
  console.log(`[verify-shots] problems: ${problems.length}`)
  for (const p of problems) console.log("  -", p)
  process.exit(problems.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})