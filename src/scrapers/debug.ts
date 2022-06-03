(async () => {
  const puppeteer = await import("puppeteer")
  const browser = await puppeteer.launch({ headless: false, devtools: false, defaultViewport: { width: 1300, height: 800 } })
  // const browser = await puppeteer.connect({ browserWSEndpoint: "ws://localhost:4000" })
  const page = await browser.newPage()

  const scraperModule: typeof import("../scrapers/alaska") = await import("./jetblue")
  const callMethod = scraperModule.scraper || scraperModule   // needed to keep data types in vscode resolving but at runtime scraperModule is actually called
  const results = await callMethod({ page, context: { origin: "SFO", destination: "JFK", departureDate: "2022-06-04" } })

  console.log(results)
  debugger
})()

export {}
