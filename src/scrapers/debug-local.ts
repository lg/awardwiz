const x = (async () => {
  const puppeteer = await import("puppeteer")
  const browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1300, height: 800 } })
  //const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:4000", defaultViewport: { width: 1300, height: 800 } })
  //const browser = await puppeteer.connect({ browserWSEndpoint: "ws://10.0.1.17:4000", defaultViewport: { width: 1400, height: 800 } })
  const browserContext = await browser.createIncognitoBrowserContext()
  const page = await browserContext.newPage()

  const scraper = await import("./delta") as any
  const results = await scraper({ page, browser, context: { origin: "SFO", destination: "LAX", departureDate: "2022-10-11" } })
  console.log(JSON.stringify(results))

  console.log("closing browser!")
  await browser.close().catch((e) => {})
  console.log("ok done")
})
void x()

export {}
