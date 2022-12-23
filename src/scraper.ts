import { chromium, firefox, webkit } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { log } from "./common.js"
import { enableCacheForContext } from "./cache.js"
import { enableBlockingForContext } from "./blocking.js"
import { env } from "node:process"
import url from "url"
import { enableStatsForContext } from "./stats.js"
import { Browser, Page } from "playwright"
import c from "ansi-colors"
import { find as findTz } from "geo-tz"

const BROWSERS: BrowserName[] = ["firefox", "webkit", "chromium"]

type BrowserName = "chromium" | "webkit" | "firefox"

export type ScraperRequest = {
  meta: ScraperMetadata
  page: Page
  logLines: string[]
  randId: number
}

export type ScraperResult<ReturnType> = {
  result: ReturnType | undefined
  failed: boolean
  logLines: string[]
}

export type ScraperMetadata = {
  name: string,
  blockUrls?: string[]
  noRandomUserAgent?: boolean
  noBlocking?: boolean
  noStealth?: boolean
  useBrowser?: BrowserName
  noProxy?: boolean
  noCache?: boolean
}

export type DebugOptions = { overrideBrowser?: BrowserName, showRequests?: boolean, showResponses?: boolean, showBlocked?: boolean, showCached?: boolean, showUncached?: boolean, trace?: boolean }
export const runScraper = async <ReturnType>(scraper: (sc: ScraperRequest) => Promise<ReturnType>, meta: ScraperMetadata, debugOptions: DebugOptions = {}): Promise<ScraperResult<ReturnType>> => {
  const startTime = Date.now()
  const randId = Math.round(Math.random() * 1000)
  const sc: ScraperRequest = { meta, page: undefined!, randId, logLines: [] }

  // randomly select browser
  const selectedBrowserName = debugOptions.overrideBrowser ?? meta.useBrowser ?? BROWSERS[Math.floor(Math.random() * BROWSERS.length)]
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
  if (url.parse(env.PROXY_ADDRESS ?? "").hostname !== null && !meta.noProxy) {
    const { host, username, password } = new URL(env.PROXY_ADDRESS!)
    proxy = { server: host, username: username, password: password }
  } else {
    log(sc, c.yellow(`Not using proxy server ${meta.noProxy ? "(the scraper has noProxy enabled)" : `(the PROXY_ADDRESS variable is ${env.PROXY_ADDRESS === undefined ? "missing" : "invalid"})` }`))
  }

  log(sc, `Starting ${c.green(selectedBrowserName)}`)
  const browser = await selectedBrowser.launch({ headless: false, proxy })
  const { ip, tz } = await getIPAndTimezone(browser)
  const context = await browser.newContext({ serviceWorkers: "block", timezoneId: tz })
  if (debugOptions.trace)
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
  log(sc, c.magenta(`Using IP ${ip} (${tz})`))

  // enable caching, blocking and stats
  if (!meta.noCache)
    await enableCacheForContext(context, `cache:${meta.name}`, { showCached: debugOptions.showCached, showUncached: debugOptions.showUncached })
  if (!meta.noBlocking)
    await enableBlockingForContext(context, meta.blockUrls, debugOptions.showBlocked)
  const getStats = enableStatsForContext(context)

  sc.page = await context.newPage()

  if (debugOptions.showRequests)
    sc.page.on("request", request => console.log(">>", request.method(), request.url()))
  if (debugOptions.showResponses)
    sc.page.on("response", async response => console.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

  let failed = false
  const scraperResult = await scraper(sc).catch(async e => {
    failed = true
    log(sc, "Scraper Error", e)
    return undefined
  })

  if (debugOptions.trace)
    await context.tracing.stop({ path: "tmp/trace.zip" })
  await browser.close()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  log(sc, `completed ${failed ? c.red("in failure ") : ""}in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${getStats().summary})`)

  return { result: scraperResult, logLines: sc.logLines, failed: false }
}

const getIPAndTimezone = async (browser: Browser) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto("http://geo.zombe.es")
  const ipGeo = JSON.parse(await page.textContent("pre") ?? "{}")
  const tz = findTz(ipGeo.geo.latitude, ipGeo.geo.longitude)[0]
  await page.close()
  await context.close()
  return { ip: ipGeo.ip, tz }
}
