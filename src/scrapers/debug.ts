import { sleep } from "./common"

type ScraperModule = typeof import("./alaska")

(async () => {
  const puppeteer = await import("puppeteer")
  //const browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1300, height: 800 } })
  //const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:4000", defaultViewport: { width: 1300, height: 800 } })
  const browser = await puppeteer.connect({ browserWSEndpoint: "ws://10.0.1.96:4000", defaultViewport: { width: 1400, height: 800 } })
  const browserContext = await browser.createIncognitoBrowserContext()
  const page = await browserContext.newPage()

  const scraperModule: ScraperModule = await import("./southwest")
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const callMethod = scraperModule.scraper || scraperModule   // needed to keep data types in vscode resolving but at runtime scraperModule is actually called
  const results = await callMethod({ page, context: { origin: "OAK", destination: "LIH", departureDate: "2022-10-30" } })

  console.log(JSON.stringify(results, null, 2))

  console.log("closing browser!")
  await page.close()
  await browserContext.close()
  await browser.close()
  await sleep(5000)

  console.log("ok done")
})()

export {}
