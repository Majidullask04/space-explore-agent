/* debug: load, click Earth, map, black hole, galaxy; screenshot each */
const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.HALLMARK_PUPPETEER,
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8642/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loader.done", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const shot = (n) => page.screenshot({ path: `.shots/dbg-${n}.png` });

  await shot("home");

  /* click Earth by projecting its world position */
  const clickBody = async (id) => {
    await page.evaluate((id) => {
      const rec = window.__cosmosProbe ? window.__cosmosProbe.posOf(id) : null;
      return rec;
    }, id).catch(() => {});
    /* fallback: click the destination button */
    await page.evaluate((id) => {
      const btn = [...document.querySelectorAll("#dest-list button")].find((b) => b.dataset.id === id);
      if (btn) btn.click();
    }, id);
    await new Promise((r) => setTimeout(r, 3400));
  };
  await clickBody("earth");
  await shot("earth-panel");

  await page.keyboard.press("Escape");
  await page.keyboard.press("m");
  await new Promise((r) => setTimeout(r, 700));
  await shot("map");
  await page.keyboard.press("Escape");

  await clickBody("cygnus");
  await shot("blackhole");
  await page.keyboard.press("Escape");

  await clickBody("galaxy");
  await new Promise((r) => setTimeout(r, 600));
  await shot("galaxy");

  /* fly forward a bit in ship mode */
  await page.keyboard.press("x");
  await page.keyboard.down("w");
  await new Promise((r) => setTimeout(r, 1500));
  await page.keyboard.up("w");
  await shot("ship");

  console.log("pageerrors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})().catch((e) => { console.error("DBG FAIL", e.message); process.exit(1); });
