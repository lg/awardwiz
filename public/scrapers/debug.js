/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-var-requires */

const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1920, height: 1080 } })
  const page = await browser.newPage()

  const scraper = require("./united")
  const results = await scraper({ page, context: { origin: "HNL", destination: "SFO", departureDate: "2022-04-21" } })

  debugger
})()
