import puppeteer = require("puppeteer")
import { scraper } from "./southwest";

(async () => {
  //const browser = await puppeteer.launch({ headless: false, devtools: false, defaultViewport: { width: 1920, height: 1080 } })
  const browser = await puppeteer.connect({ browserWSEndpoint: "ws://localhost:4000" })
  const page = await browser.newPage()
  const results = await scraper({ page, context: { origin: "OAK", destination: "LIH", departureDate: "2022-07-25" } })

  console.log(results)
  debugger
})()
