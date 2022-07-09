(async () => {
  const puppeteer = await import("puppeteer")
  //const browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1300, height: 800 } })
  //const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:4000", defaultViewport: { width: 1300, height: 800 } })
  const browser = await puppeteer.connect({ browserWSEndpoint: "ws://10.0.1.17:4000", defaultViewport: { width: 1300, height: 800 } })
  const page = await browser.newPage()

  const scraperModule: typeof import("../scrapers/alaska") = await import("./delta")
  const callMethod = scraperModule.scraper || scraperModule   // needed to keep data types in vscode resolving but at runtime scraperModule is actually called
  const results = await callMethod({ page, context: { origin: "AMS", destination: "DXB", departureDate: "2022-08-17" } })

  console.log(results)
  debugger
})()

export {}
