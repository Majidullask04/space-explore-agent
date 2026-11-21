import puppeteer from "puppeteer-core"

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  defaultViewport: { width: Number(process.argv[2]) || 1440, height: Number(process.argv[3]) || 900 },
})
const page = await browser.newPage()
await page.goto("http://localhost:5199", { waitUntil: "networkidle0" })
await new Promise((r) => setTimeout(r, 3000))

const stops = [
  ["ch2-approach", 0.14],
  ["ch3-held", 0.3],
  ["ch4-possibilities", 0.45],
  ["ch5-mytime", 0.68],
  ["ch6-sunrise", 0.9],
  ["ch6-end", 1],
]
for (const [name, frac] of stops) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * f, behavior: "instant" })
  }, frac)
  await new Promise((r) => setTimeout(r, 3500))
  await page.screenshot({ path: `.hallmark/shots/journey-${name}.png` })
  console.log("shot", name)
}
await browser.close()
