import * as functions from "firebase-functions"
import * as Playwright from "playwright-core"
import chromium from "@sparticuz/chromium"

import type { FlightWithFares, ScraperQuery } from "../../src/types/scrapers"

export type BrowserlessInput = { page: Playwright.Page, context: ScraperQuery, browser?: any, timeout?: number }

let browser_: Playwright.Browser | undefined
const getBrowser = async () => {
  process.env.PUPPETEER_EXPERIMENTAL_CHROMIUM_MAC_ARM = "true"
  if (!browser_) {
    console.log("Browser didn't exist, creating")
    browser_ = await Playwright.firefox.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath
    })
    console.log("Browser created")
  }
  return browser_
}

exports.runScraper = functions.runWith({ memory: "4GB", timeoutSeconds: 30}).https.onRequest(async (request, response) => {
  const context = request.query as ScraperQuery & { scraper: string }

  const scraperStartTime = Date.now()
  console.log(`*** Starting scraper with ${JSON.stringify(context)}}`)

  const browser = await getBrowser()
  // console.log("creating incognito context")
  // const browserContext = await browser.createIncognitoBrowserContext()
  console.log("new page")
  const page = await browser.newPage()

  console.log("Loading github")
  await page.goto("https://www.github.com")
  console.log("Done loading github")

  const result: FlightWithFares[] | undefined = []
  const errored = result === undefined
  console.log(`*** Completed scraper ${ errored ? "with error " : ""}after ${Math.round(Date.now() - scraperStartTime) / 1000} seconds with ${result.length} result(s)`)
  response.status(200).send({ done: true })
})
