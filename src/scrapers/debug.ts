/* eslint-disable @typescript-eslint/prefer-ts-expect-error */
import { AxiosError } from "axios"
import { runScraper } from "../helpers/runScraper"

const [origin, destination, departureDate, scraper, mode, ip] = process.argv[2].split(",")

const mainRemote = (async () => {
  const startTime = Date.now()
  const query = { origin, destination, scraper, departureDate }
  const raw = await runScraper(query.scraper, query, ["unknown"], undefined).catch((error: AxiosError) => error)

  console.log(`completed in: ${(Date.now() - startTime).toLocaleString()} ms`)
  if (raw instanceof AxiosError) {
    console.log(`error: ${raw.response!.status} ${raw.response!.statusText}\n${JSON.stringify(raw.response!.data, undefined, 2)}`)

  } else {
    console.log("results:")
    console.log(JSON.stringify(raw.data))
  }
})

const mainLocal = (async () => {
  const puppeteer = await import("puppeteer")

  let browser
  if (mode === "browserless-websockets")
    browser = await puppeteer.connect({ browserWSEndpoint: `ws://${ip}:4000`, defaultViewport: { width: 1400, height: 800 } })
  else if (mode === "chromium")
    browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1300, height: 800 } })
  else
    throw new Error("invalid mode")

  const browserContext = await browser.createIncognitoBrowserContext()
  const page = await browserContext.newPage()

  const scraperImport = await import(`./${scraper}`) as any
  const results = await scraperImport({ page, browser, context: { origin, destination, departureDate } })
  console.log(JSON.stringify(results))

  console.log("closing browser!")
  await browser.close().catch((error) => {})
  console.log("ok done")
})

if (mode === "browserless-func")
  // @ts-ignore
  void mainRemote()
else
  // @ts-ignore
  void mainLocal()

export {}
