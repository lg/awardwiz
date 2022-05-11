import puppeteer = require("puppeteer")

(async () => {
  // const browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1920, height: 1080 } })
  const browser = await puppeteer.connect({ browserWSEndpoint: "ws://localhost:4000" })
  const page = await browser.newPage()

  const alaska = await import("./united")
  const results = await alaska.scraper({ page, context: { origin: "SFO", destination: "JFK", departureDate: "2022-07-25" } })

  console.log(results)
  debugger
})()
