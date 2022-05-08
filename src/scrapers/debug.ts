import puppeteer = require("puppeteer")

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1920, height: 1080 } })
  const page = await browser.newPage()

  // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
  const scraper = require("./united")
  const results = await scraper({ page, context: { origin: "HNL", destination: "SFO", departureDate: "2022-07-25" } })

  console.log(results)
  debugger
})()
