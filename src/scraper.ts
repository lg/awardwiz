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
import pRetry from "p-retry"

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
  logLines: string[]
}

export type ScraperMetadata = {
  name: string,
  blockUrls?: string[]
  noRandomUserAgent?: boolean
  noBlocking?: boolean
  noStealth?: boolean
  useBrowser?: BrowserName
  noCache?: boolean
}

const NAV_WAIT_COMMIT_MS = 5000

export type DebugOptions = { overrideBrowser?: BrowserName, showRequests?: boolean, showResponses?: boolean, showBlocked?: boolean, showCached?: boolean, showUncached?: boolean, trace?: boolean, noProxy?: boolean }
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
  if (url.parse(env.PROXY_ADDRESS ?? "").hostname !== null && !debugOptions.noProxy) {
    const { host, username, password } = new URL(env.PROXY_ADDRESS!)
    proxy = { server: host, username: username, password: password }
  } else {
    log(sc, c.yellow(`Not using proxy server ${debugOptions.noProxy ? "(noProxy option enabled)" : `(the PROXY_ADDRESS variable is ${env.PROXY_ADDRESS === undefined ? "missing" : "invalid"})` }`))
  }

  log(sc, `Starting ${c.green(selectedBrowserName)}`)
  const browser = await selectedBrowser.launch({ headless: false, proxy })

  const ipStartTime = Date.now()
  const { ip, tz } = await pRetry(() => getIPAndTimezone(browser), { retries: 2, onFailedAttempt(error) {
    log(sc, c.yellow(`Failed to get IP and timezone (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))
  }, })
  log(sc, c.magenta(`Using IP ${ip} (${tz}) (took ${(Date.now() - ipStartTime)}ms)`))

  const context = await browser.newContext({ serviceWorkers: "block", timezoneId: tz })
  if (debugOptions.trace)
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })

  // enable caching, blocking and stats
  if (!meta.noCache)
    await enableCacheForContext(context, `cache:${meta.name}`, { showCached: debugOptions.showCached, showUncached: debugOptions.showUncached })
  if (!meta.noBlocking)
    await enableBlockingForContext(context, meta.blockUrls, debugOptions.showBlocked)
  const getStats = enableStatsForContext(context)

  if (debugOptions.showRequests)
    context.on("request", request => console.log(">>", request.method(), request.url()))
  if (debugOptions.showResponses)
    context.on("response", async response => console.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

  const scraperResult = await pRetry(async () => {
    sc.page = await context.newPage()
    return scraper(sc).finally(() => sc.page.close())

  }, { retries: 2, onFailedAttempt(error) {
    log(sc, c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))
  }, }).catch(e => {
    log(sc, c.red(`Failed to run scraper: ${e.message}`))
    return undefined
  })

  if (debugOptions.trace)
    await context.tracing.stop({ path: "tmp/trace.zip" })
  await browser.close()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  log(sc, `completed ${scraperResult === undefined ? c.red("in failure ") : ""}in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${getStats().summary})`)

  return { result: scraperResult, logLines: sc.logLines }
}

const getIPAndTimezone = async (browser: Browser) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  const ret = await page.goto("http://ipv4.geojs.io", { waitUntil: "load", timeout: 100 }) //NAV_WAIT_COMMIT_MS })
    .then(async response => ({ ok: !!response, status: response?.status() ?? 0, out: await response?.text() ?? "" }))
    .finally(() => context.close())

  const { ip, tz } = /IP: (?<ip>[\d.]+)\n[\s\S]+Timezone: (?<tz>.*)\n/u.exec(ret.out)?.groups ?? {}
  if (!ret.ok || !ip || !tz)
    throw new Error(`Failed to get ip/timezone (status ${ret.status}): ${ret.out}`)

  return { ip, tz }
}
