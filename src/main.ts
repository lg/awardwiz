import { chromium, firefox, webkit } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { AwardWizRequest, BrowserName, ScraperModule, ScraperQuery } from "./types.js"
import { log } from "./common.js"
import { enableCacheForContext } from "./cache.js"
import { enableBlockingForContext } from "./blocking.js"
import { env } from "node:process"
import url from "url"

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

  let proxy = undefined
  if (url.parse(env.PROXY_ADDRESS ?? "").hostname !== null) {
    const { host, username, password } = new URL(env.PROXY_ADDRESS!)
    proxy = { server: host, username: username, password: password }
  } else {
    log(aw, `\x1b[31mNot using proxy server (the PROXY_ADDRESS variable is ${env.PROXY_ADDRESS === undefined ? "missing" : "invalid"})\x1b[0m`)
  }

  log(aw, `Starting ${selectedBrowserName} for ${query.origin}->${query.destination} on ${query.departureDate}`)
  const browser = await selectedBrowser.launch({ headless: false, proxy })
  const context = await browser.newContext({ serviceWorkers: "block" })

  await enableCacheForContext(context, `cache:${scraperName}`, { showCached: debugOptions.showCached, showUncached: debugOptions.showUncached })
  if (!scraper.meta.noBlocking)
    await enableBlockingForContext(context, scraper.meta.blockUrls, debugOptions.showBlocked)

  aw.page = await context.newPage()

  if (debugOptions.showRequests)
    aw.page.on("request", request => console.log(">>", request.method(), request.url()))
  if (debugOptions.showResponses)
    aw.page.on("response", async response => console.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

  let totCacheHits = 0, totCacheMisses = 0, bytesDownloaded = 0
  const domains: Record<string, number> = {}
  aw.page.on("response", async response => {
    if (await response.headerValue("x-fromcache")) {
      totCacheHits += 1
    } else {
      totCacheMisses += 1
      const hostname = new URL(response.url()).hostname
      const bytes = parseInt(await response.headerValue("content-length") ?? (await response.body()).byteLength.toString())
      domains[hostname] = (domains[hostname] || 0) + bytes
      bytesDownloaded += bytes
    }
  })

  const result = await scraper.runScraper(aw).catch(async e => {
    log(aw, `Error: ${e.message}`)
    return []
  })

  await browser.close()
  log(aw, `completed with ${result.length} results in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${totCacheHits} cache hits · ${totCacheMisses} cache misses · ${Object.keys(domains).length} domains · ${bytesDownloaded.toLocaleString("en-US")} bytes)`)

  return result
}

await runScraper("aa", { origin: "JFK", destination: "SFO", departureDate: "2022-12-19" }, { overrideBrowser: "chromium" })
