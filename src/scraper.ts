import { chromium, firefox, webkit } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { log } from "./common.js"
import { enableCacheForContext } from "./cache.js"
import { enableBlockingForContext } from "./blocking.js"
import { env } from "node:process"
import url from "url"
import { enableStatsForContext } from "./stats.js"
import { Browser, BrowserContext, Page } from "playwright"
import c from "ansi-colors"
import pRetry from "p-retry"
import globToRegexp from "glob-to-regexp"
import UserAgent from "user-agents"

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
  /** Unique name for the scraper */
  name: string,

  /** When using proxies, some slyly try to man-in-the-middle to see what you're doing. Do not turn this on unless
   * you're only scraping publicly available information. */
  unsafeHttpsOk: boolean

  /** Blocks urls (as per [Adblock format](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax)). use
   * `showBlocked` debug option to iterate. Does not work if `noBlocking` is set to `true`.
   * @default [] */
  blockUrls?: string[]

  /** Normally we use the browser's default user agent, setting this to `true` will use a random user agent that's
   * associated with the browser and platform. Using the same user agent for a lot of requests will get some websites to
   * detect you faster, but using a random user agent where they test different features you may/may not support could
   * also trigger detection.
   * @default false */
  useRandomUserAgent?: boolean

  /** By default will auto-block easylist and other similar lists (see `src/blocking.ts`), this disables that. These
   * blockers can sometimes block telemetry used to assess if you're a not bot or not. Except for beacons or ads or
   * similar, prefer to rely on default caching or use `forceCache` instead of this since blocking assets can break
   * expected javascript execution or page layout. `blockUrls` will not work if this is set to `true`.
   * @default false */
  noBlocking?: boolean

  /** Some websites don't return proper cache headers, this forces matching globs to get cached. Use the `showUncached`
   * debug option to iterate. Does not work if `noCache` is set to `true`.
   * @default [] */
  forceCache?: string[]

  /** We use puppeteer-extra-plugin-stealth to hide things Playwright/Docker/headlessness does which could expose that
  * we're a bot versus a human. This disables that.
  * @default false */
  noStealth?: boolean

  /** Pick the browser(s) to randomize between. Can be "webkit", "firefox", "chromium", or an array of those.
   * @default ["webkit", "firefox", "chromium"] */
  useBrowser?: BrowserName | BrowserName[]

  /** Disable caching (will be much slower, but could be useful for websites that are sensitive about the time it takes
   * to search). `forceCache` will not work if this is set to `true`.
   * @default false */
  noCache?: boolean

  /** Some anti-botting detects when your IP's timezone is different from the browser's settings. This flag looks up the
  * current IP (which is likely the proxy's IP) and sets the timezone. Note this can add 1-2 seconds to the scraper. Be
  * aware that if your proxy changes IP with every request, this will be a problem. Best to use session-based proxies.
  * @default false */
  useIpTimezone?: boolean
}

export type DebugOptions = {
  showRequests?: boolean,
  showResponses?: boolean,
  showBlocked?: boolean,
  showCached?: boolean,
  showUncached?: boolean,
  trace?: boolean,
  noProxy?: boolean,
  showFullResponse?: string[],
  showFullRequest?: string[],
  pauseAfterRun?: boolean,
  pauseAfterError?: boolean,

  /** When using a proxy service that has it's passwords in the format: `/\S{16}_country-\S+_session-)\S{8}$/`, we'll
   * randomize text for those last 8 characters which should get a new proxy. This happens every time a new browser is
   * opened (so not on retries).
   * @default true */
  changeProxies?: boolean
}

const NAV_WAIT_COMMIT_MS = 15000
const MAX_ATTEMPTS = 3

export const runScraper = async <ReturnType>(scraper: (sc: ScraperRequest) => Promise<ReturnType>, meta: ScraperMetadata, debugOptions: DebugOptions = {}): Promise<ScraperResult<ReturnType>> => {
  const startTime = Date.now()
  const randId = Math.round(Math.random() * 1000)
  const sc: ScraperRequest = { meta, page: undefined!, randId, logLines: [] }

  let browser: Browser | undefined
  let context: BrowserContext | undefined
  let getStats
  let success = false

  try {
    // randomly select browser
    const pickFromBrowsers = Array.isArray(meta.useBrowser) ? meta.useBrowser : (typeof meta.useBrowser === "string" ? [meta.useBrowser] : BROWSERS)
    const selectedBrowserName = pickFromBrowsers[Math.floor(Math.random() * pickFromBrowsers.length)]
    const selectedBrowser = {"firefox": firefox, "webkit": webkit, "chromium": chromium}[selectedBrowserName]

    // load stealth and handle incompatible stealth plugins
    if (!meta.noStealth) {
      const stealth = StealthPlugin()
      if (selectedBrowserName === "webkit")
        ["navigator.webdriver", "user-agent-override"].forEach(e => stealth.enabledEvasions.delete(e))
      if (selectedBrowserName === "firefox")
        ["user-agent-override"].forEach(e => stealth.enabledEvasions.delete(e))
      selectedBrowser.use(stealth)
    }

    // load proxy
    let proxy = undefined
    if (url.parse(env.PROXY_ADDRESS ?? "").hostname !== null && !debugOptions.noProxy) {
      const { host, username, password } = new URL(env.PROXY_ADDRESS!)
      proxy = { server: host, username: username, password: password }

      // generate random proxy
      const psPasswordRegexp = /(?<start>\S{16}_country-\S+_session-)\S{8}$/u.exec(password)
      if ((debugOptions.changeProxies ?? true) && psPasswordRegexp)
        proxy.password = psPasswordRegexp.groups!.start + Math.random().toString(36).slice(2).substring(0, 8)
    } else {
      log(sc, c.yellow(`Not using proxy server ${debugOptions.noProxy ? "(noProxy option enabled)" : `(the PROXY_ADDRESS variable is ${env.PROXY_ADDRESS === undefined ? "missing" : "invalid"})` }`))
    }

    log(sc, `Starting ${c.green(selectedBrowserName)}`)
    browser = await selectedBrowser.launch({ headless: false, proxy })

    const ipStartTime = Date.now()
    const { ip, tz } = meta.useIpTimezone ? await pRetry(() => getIPAndTimezone(browser!), { retries: 2, onFailedAttempt(error) {
      log(sc, c.yellow(`Failed to get IP and timezone (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))
    }, }) : { ip: undefined, tz: undefined }
    if (ip && tz)
      log(sc, c.magenta(`Using IP ${ip} (${tz}) (took ${(Date.now() - ipStartTime)}ms)`))

    // generate random user agent
    let userAgent
    if (meta.useRandomUserAgent) {
      userAgent = new UserAgent({
        "webkit": { vendor: "Apple Computer, Inc.", deviceCategory: "desktop" },
        "chromium": { vendor: "Google Inc.", deviceCategory: "desktop" },
        "firefox": [/Firefox/u, { deviceCategory: "desktop" }]
      }[selectedBrowserName]).toString()
    }

    context = await browser.newContext({ serviceWorkers: "block", timezoneId: tz, ignoreHTTPSErrors: meta.unsafeHttpsOk, locale: "en-US", userAgent })
    if (debugOptions.trace)
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })

    // enable caching, blocking and stats
    if (!meta.noCache)
      await enableCacheForContext(context, `cache:${meta.name}`, meta.forceCache ?? [], { showCached: debugOptions.showCached, showUncached: debugOptions.showUncached })
    if (!meta.noBlocking)
      await enableBlockingForContext(context, meta.blockUrls, debugOptions.showBlocked)
    getStats = enableStatsForContext(context)

    // debugging options to see requests and responses (and optionally the full bodies)
    if (debugOptions.showRequests)
      context.on("request", request => console.log(">>", request.method(), request.url()))
    if (debugOptions.showResponses)
      context.on("response", async response => console.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

    const fullRequestRegexps = (debugOptions.showFullRequest ?? []).map((glob) => globToRegexp(glob, { extended: true }))
    fullRequestRegexps.length > 0 && context.on("request", async (request) => {
      if (fullRequestRegexps.some((pattern) => pattern.test(request.url()))) {
        log(sc, "\n", c.whiteBright(`*** Outputting request for ${request.url()} ***`), "\n",
          c.whiteBright(request.postData() ?? "(no post data)"), "\n", c.whiteBright("*******"))
      }
    })

    const fullResponseRegexps = (debugOptions.showFullResponse ?? []).map((glob) => globToRegexp(glob, { extended: true }))
    fullResponseRegexps.length > 0 && context.on("response", async (response) => {
      if (fullResponseRegexps.some((pattern) => pattern.test(response.url()))) {
        log(sc, "\n", c.whiteBright(`*** Outputting response for ${response.url()} ***`), "\n",
          c.whiteBright(await response.text()), "\n", c.whiteBright("*******"))
      }
    })

    // run scraper
    const scraperResult = await pRetry(async () => {
      sc.page = await context!.newPage()
      return scraper(sc)

    }, { retries: 2, onFailedAttempt: async (error) => {
      if (debugOptions.pauseAfterError) {
        log(sc, c.bold(c.redBright(`\n*** paused (open browser to http://127.0.0.1:8080/vnc.html): ${error.message.split("\n")[0]} ***\n`)), error)
        await sc.page.pause()
      }
      log(sc, c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))

    }}).catch(async e => {
      log(sc, c.red(`Failed to run scraper: ${e.message}`))
      return undefined

    }).finally(async () => {
      if (debugOptions.pauseAfterRun) {
        log(sc, c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8080/vnc.html) ***")))
        await sc.page.pause()
      }

      await sc.page.close()
    })

    success = true
    return { result: scraperResult, logLines: sc.logLines }

  } catch (e) {
    log(sc, c.red("Failed to run scraper"), e)
    return { result: undefined, logLines: sc.logLines }

  } finally {
    if (debugOptions.trace)
      await context?.tracing.stop({ path: "tmp/trace.zip" })
    if (context)
      await context.close()
    if (browser)
      await browser.close()

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    log(sc, `completed ${!success ? c.red("in failure ") : ""}in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${getStats?.().summary ?? ""})`)
  }
}

const getIPAndTimezone = async (browser: Browser) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  const PROVIDERS = [
    { url: "https://json.geoiplookup.io", ip_field: "ip", tz_field: "timezone_name" },
    // { url: "https://ipapi.co/json", ip_field: "ip", tz_field: "timezone" },
    // { url: "https://ipinfo.io/json", ip_field: "ip", tz_field: "timezone" }
  ]
  const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)]

  const ret = await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: NAV_WAIT_COMMIT_MS })
    .then(async response => ({ ok: !!response, status: response?.status() ?? 0, out: await response?.text() ?? "" }))
    .finally(() => context.close())

  const json = JSON.parse(ret.out)
  const [ip, tz] = [json[provider.ip_field], json[provider.tz_field]] as [string | undefined, string | undefined]
  if (!ret.ok || !ip || !tz)
    throw new Error(`Failed to get ip/timezone (status ${ret.status}): ${ret.out}`)

  return { ip, tz }
}
