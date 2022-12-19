import { chromium, firefox, webkit } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { AwardWizRequest, BrowserName, ScraperModule, ScraperQuery } from "./types.js"
import { log } from "./common.js"
import { enableCacheForContext } from "./cache.js"
import { enableBlockingForContext } from "./blocking.js"
import { env } from "node:process"
import url from "url"
import { enableStatsForContext } from "./stats.js"

const BROWSERS: BrowserName[] = ["firefox", "webkit", "chromium"]

type DebugOptions = { overrideBrowser?: BrowserName, showRequests?: boolean, showResponses?: boolean, showBlocked?: boolean, showCached?: boolean, showUncached?: boolean }
const runScraper = async (scraperName: string, query: ScraperQuery, debugOptions: DebugOptions = {}) => {
  const startTime = Date.now()
  const randId = Math.round(Math.random() * 1000)
  const scraper = await import(`./scrapers/${scraperName.match(/[a-z0-9]+/)![0]}.js`) as ScraperModule
  const aw: AwardWizRequest = { query, meta: scraper.meta, page: undefined!, randId, logLines: [] }

  // randomly select browser
  const selectedBrowserName = debugOptions.overrideBrowser ?? scraper.meta.useBrowser ?? BROWSERS[Math.floor(Math.random() * BROWSERS.length)]
  const selectedBrowser = {"firefox": firefox, "webkit": webkit, "chromium": chromium}[selectedBrowserName]

  // load stealth and handle incompatible stealth plugins
  const stealth = StealthPlugin()
  if (selectedBrowserName === "webkit")
    ["navigator.webdriver", "user-agent-override"].forEach(e => stealth.enabledEvasions.delete(e))
  if (selectedBrowserName === "firefox")
    ["user-agent-override"].forEach(e => stealth.enabledEvasions.delete(e))
  selectedBrowser.use(stealth)

  // load proxy
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

  // enable caching, blocking and stats
  await enableCacheForContext(context, `cache:${scraperName}`, { showCached: debugOptions.showCached, showUncached: debugOptions.showUncached })
  if (!scraper.meta.noBlocking)
    await enableBlockingForContext(context, scraper.meta.blockUrls, debugOptions.showBlocked)
  const getStats = enableStatsForContext(context)

  aw.page = await context.newPage()
  await aw.page.goto("https://checkip.amazonaws.com").then(async () => log(aw, `\x1b[35mUsing IP ${(await aw.page.textContent("body"))?.trim()}\x1b[0m`))
  await aw.page.close()
  aw.page = await context.newPage()

  if (debugOptions.showRequests)
    aw.page.on("request", request => console.log(">>", request.method(), request.url()))
  if (debugOptions.showResponses)
    aw.page.on("response", async response => console.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

  let failed = false
  const result = await scraper.runScraper(aw).catch(async e => {
    failed = true
    log(aw, "Scraper Error", e)
    return []
  })

  await browser.close()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  log(aw, `completed ${failed ? "\x1b[31min failure\x1b[0m " : ""}with ${result.length} results in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${getStats().summary})`)

  return result
}

for (let i: number = 0; i < 5; i += 1) {
  await runScraper("aa", { origin: "JFK", destination: "SFO", departureDate: "2022-12-19" })
}
