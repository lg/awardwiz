import { chromium, firefox, webkit } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { AwardWizRequest, BrowserName, ScraperModule, ScraperQuery } from "./types.js"
import { log } from "./common.js"
import { enableCacheForContext } from "./cache.js"
import { enableBlockingForContext } from "./blocking.js"

const BROWSERS: BrowserName[] = ["firefox", "webkit", "chromium"]

type DebugOptions = { overrideBrowser?: BrowserName, showRequests?: boolean, showResponses?: boolean, showBlocked?: boolean, showCached?: boolean, showUncached?: boolean }
const runScraper = async (scraperName: string, query: ScraperQuery, debugOptions: DebugOptions = {}) => {
  const startTime = Date.now()
  const randId = Math.round(Math.random() * 1000)
  const scraper = await import(`./scrapers/${scraperName.match(/[a-z0-9]+/)![0]}.js`) as ScraperModule
  const aw: AwardWizRequest = { query, meta: scraper.meta, page: undefined!, randId, logLines: [] }

  const selectedBrowserName = debugOptions.overrideBrowser ?? scraper.meta.useBrowser ?? BROWSERS[Math.floor(Math.random() * BROWSERS.length)]
  const selectedBrowser = {"firefox": firefox, "webkit": webkit, "chromium": chromium}[selectedBrowserName]
  selectedBrowser.use(StealthPlugin())

  log(aw, `Starting ${selectedBrowserName} for ${query.origin}->${query.destination} on ${query.departureDate}`)
  const browser = await selectedBrowser.launch({ headless: false })
  const context = await browser.newContext({ serviceWorkers: "block" })

  await enableCacheForContext(context, `cache:${scraperName}`, { showCached: debugOptions.showCached, showUncached: debugOptions.showUncached })
  if (!scraper.meta.noBlocking)
    await enableBlockingForContext(context, scraper.meta.blockUrls, debugOptions.showBlocked)

  aw.page = await context.newPage()

  if (debugOptions.showRequests)
    aw.page.on("request", request => console.log(">>", request.method(), request.url()))
  if (debugOptions.showResponses)
    aw.page.on("response", async response => console.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

  const result = await scraper.runScraper(aw)

  await browser.close()
  log(aw, `completed with ${result.length} results in ${Date.now() - startTime}ms`)
  return result
}

await runScraper("aa", { origin: "JFK", destination: "SFO", departureDate: "2022-12-19" }, { overrideBrowser: "chromium" })
