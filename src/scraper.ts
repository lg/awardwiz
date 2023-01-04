import { env } from "node:process"
import c from "ansi-colors"
import url from "url"
import pRetry from "p-retry"
import { Browser, BrowserContext, Page } from "playwright"
import UserAgent from "user-agents"
import { promises as fs } from "fs" // used for caching
import { FiltersEngine, fromPlaywrightDetails, NetworkFilter } from "@cliqz/adblocker-playwright"
import { enableStatsForContext } from "./stats.js"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { AugmentedBrowserLauncher, chromium, firefox, webkit } from "playwright-extra"
import fetch from "cross-fetch"
import { logGlobal, logWithId } from "./log.js"
import { enableCacheForContext } from "./cache.js"
import globToRegexp from "glob-to-regexp"

export const BROWSERS: BrowserName[] = ["firefox", "webkit", "chromium"]
const IPTZ_MAX_WAIT_MS = 4000

export type BrowserName = "chromium" | "webkit" | "firefox"

export type ScraperMetadata = {
  /** Unique name for the scraper */
  name: string,

  /** Blocks urls (as per [Adblock format](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax)). use
   * `showBlocked` debug option to iterate.
   * @default [] */
  blockUrls?: string[]

  /** By default will auto-block easylist and other similar lists (see `src/blocking.ts`), this disables that. These
   * blockers can sometimes block telemetry used to assess if you're a not bot or not. Except for beacons or ads or
   * similar, prefer to rely on default caching or use `forceCache` instead of this since blocking assets can break
   * expected javascript execution or page layout.
   * @default true */
  useAdblockLists?: boolean

  /** Some websites don't return proper cache headers, this forces matching globs to get cached. Use the `showUncached`
   * debug option to iterate. Does not work if `useCache` is set to `false`.
   * @default [] */
  forceCacheUrls?: string[]

  /** Pick the browser(s) to randomize between. Can be "webkit", "firefox", "chromium", or an array of those.
   * @default ["webkit", "firefox", "chromium"] */
  useBrowser?: BrowserName | BrowserName[]

  /** Caching is on by default, but can be turned off using this flag. This will make requests much slower, but could
   * catch certain improperly configured servers. `forceCacheUrls` will not work if this is set to `false`.
   * @default true */
  useCache?: boolean
}

export type DebugOptions = {
  showRequests?: boolean,
  showResponses?: boolean,
  showBlocked?: boolean,
  showCached?: boolean,
  showUncached?: boolean,

  /** Shows browsers being created/destroyed by the pool
   * @default false */
  showBrowserDebug?: boolean,

  /** Will use a proxy server for all requests. Note that only HTTP/HTTPS proxies are supported for now.
   * @default true */
  useProxy?: boolean,

  showFullResponse?: string[],
  showFullRequest?: string[],
  pauseAfterRun?: boolean,
  pauseAfterError?: boolean,

  /** When using a proxy service that has it's passwords in the format: `/\S{16}_country-\S+_session-)\S{8}$/`, we'll
   * randomize text for those last 8 characters which should get a new proxy. This happens every time a new browser is
   * opened (so not on retries).
   * @default true */
  changeProxies?: boolean

  /** If a scraper fails, we'll retry until this many attempts.
   * @default 3
   */
  maxAttempts?: number
}

export class Scraper {
  private id: string = `b${Math.round(Math.random() * 1000).toString().padStart(3, "0")}`
  private debugOptions: DebugOptions
  private filtersEngine?: FiltersEngine
  private browserType: AugmentedBrowserLauncher

  public browser!: Browser
  public context!: BrowserContext
  public page!: Page
  public logLines: string[] = []
  public stats = { totCacheHits: 0, totCacheMisses: 0, totDomains: 0, bytesDownloaded: 0, totBlocked: 0 }

  public log(...args: any[]) {
    logWithId(this.id, ...args)
  }

  static {
    logGlobal("Configuring browsers for evasions")
    chromium.use(StealthPlugin())
    const webkitStealth = StealthPlugin();
    ["navigator.webdriver", "user-agent-override"].forEach(e => webkitStealth.enabledEvasions.delete(e))
    webkit.use(webkitStealth)
    const firefoxStealth = StealthPlugin();
    ["user-agent-override"].forEach(e => firefoxStealth.enabledEvasions.delete(e))
    firefox.use(firefoxStealth)
  }

  constructor(browserType: AugmentedBrowserLauncher, debugOptions: DebugOptions) {
    this.debugOptions = debugOptions
    this.browserType = browserType
  }

  async create() {
    const startTime = Date.now()
    if (this.debugOptions.showBrowserDebug)
      this.log(`creating ${c.green(this.browserType.name())} browser`)

    let retries = 0
    const sc = this
    const browser = await pRetry(() => this.createAttempt(), { retries: 5, async onFailedAttempt(error) {
      retries += 1
      await sc.destroy(error.message.split("\n")[0])
    }})

    if (this.debugOptions.showBrowserDebug)
      this.log(`created browser in ${Date.now() - startTime}ms${retries > 0 ? ` (after ${retries} retry)` : "" }`)
    return browser
  }

  async createAttempt() {
    // Select a proxy server
    const proxies = env.PROXY_ADDRESS?.split(",")
    const selectedProxy = proxies ? proxies[Math.floor(Math.random() * proxies.length)] : undefined
    let proxy
    if ((this.debugOptions.useProxy ?? true) && selectedProxy && url.parse(selectedProxy).hostname !== null) {
      const { host, username, password, protocol } = new URL(selectedProxy)
      proxy = { server: `${protocol}//${host}`, username: username, password: password }

      // generate random proxy
      const psPasswordRegexp = /(?<start>\S{16}_country-\S+_session-)\S{8}$/u.exec(password)
      if ((this.debugOptions.changeProxies ?? true) && psPasswordRegexp)
        proxy.password = psPasswordRegexp.groups!.start + Math.random().toString(36).slice(2).substring(0, 8)
    } else {
      if (this.debugOptions.showBrowserDebug)
        this.log(c.yellow(`Not using proxy server ${!(this.debugOptions.useProxy ?? true) ? "(useProxy option not enabled)" : `(${env.PROXY_ADDRESS === undefined ? "missing" : "invalid"})` }`))
    }

    // Start browser
    this.browser = await this.browserType.launch({ headless: false, proxy })

    // Get current IP and timezone
    const { tz } = await getIPAndTimezone(this.browser)
    if (this.debugOptions.showBrowserDebug)
      this.log(c.magenta(`IP resolved to timezone ${tz}`))

    // generate random user agent
    const userAgent = new UserAgent({
      "webkit": { vendor: "Apple Computer, Inc.", deviceCategory: "desktop" },
      "chromium": { vendor: "Google Inc.", deviceCategory: "desktop" },
      "firefox": [/Firefox/u, { deviceCategory: "desktop" }]
    }[this.browserType.name()]).toString()

    // create the context
    this.context = await this.browser.newContext({ serviceWorkers: "block", timezoneId: tz, locale: "en-US", userAgent })

    // enable adblocking (assuming we're going to use them)
    const adblockCache = { path: "tmp/adblocker.bin", read: fs.readFile, write: fs.writeFile }
    this.filtersEngine = await FiltersEngine.fromLists(fetch, [
      "https://easylist.to/easylist/easylist.txt", "https://easylist.to/easylist/easyprivacy.txt", "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
      "https://easylist.to/easylist/fanboy-social.txt", "https://secure.fanboy.co.nz/fanboy-annoyance.txt", "https://easylist.to/easylist/easylist.txt",
      "https://cdn.jsdelivr.net/gh/badmojr/1Hosts@master/Xtra/adblock.txt"
    ], undefined, adblockCache)

    // enable stats
    enableStatsForContext(this)

    // debugging options to see requests and responses (and optionally the full bodies)
    if (this.debugOptions.showRequests)
      this.context.on("request", request => this.log(">>", request.method(), request.url()))
    if (this.debugOptions.showResponses)
      this.context.on("response", async response => this.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

    const fullRequestRegexps = (this.debugOptions.showFullRequest ?? []).map((glob) => globToRegexp(glob, { extended: true }))
    fullRequestRegexps.length > 0 && this.context.on("request", async (request) => {
      if (fullRequestRegexps.some((pattern) => pattern.test(request.url()))) {
        this.log("\n", c.whiteBright(`*** Outputting request for ${request.url()} ***`), "\n",
          c.whiteBright(request.postData() ?? "(no post data)"), "\n", c.whiteBright("*******"))
      }
    })

    const fullResponseRegexps = (this.debugOptions.showFullResponse ?? []).map((glob) => globToRegexp(glob, { extended: true }))
    fullResponseRegexps.length > 0 && this.context.on("response", async (response) => {
      if (fullResponseRegexps.some((pattern) => pattern.test(response.url()))) {
        this.log("\n", c.whiteBright(`*** Outputting response for ${response.url()} ***`), "\n",
          c.whiteBright(await response.text()), "\n", c.whiteBright("*******"))
      }
    })
  }

  public async destroy(debugReason: string = "") {
    if (this.debugOptions.showBrowserDebug)
      this.log(`destroying context and browser${debugReason ? ` (${debugReason})` : ""}`)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    for (const page of this.context?.pages() ?? [])
      await page.close()

    // eslint-disable-next-line no-restricted-globals
    void new Promise((resolve) => setTimeout(resolve, 1000)).then(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.context) await this.context.close()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.browser) await this.browser.close()
      return
    })
  }

  public async runAttempt<ReturnType>(scraper: (sc: Scraper) => Promise<ReturnType>, meta: ScraperMetadata): Promise<ReturnType> {
    // enable blocking urls (and add extra urls requested by scraper)
    if (meta.useAdblockLists ?? true)
      this.filtersEngine = FiltersEngine.empty()    // wipe the precached adblock lists
    if (meta.blockUrls)
      this.filtersEngine?.update({ newNetworkFilters: meta.blockUrls.map((urlToAdd) => NetworkFilter.parse(urlToAdd)!) })

    await this.context.route("**/*", route => {
      const adblockReq = fromPlaywrightDetails(route.request())
      const engineMatch = this.filtersEngine?.match(adblockReq)
      if (engineMatch?.match) {
        if (this.debugOptions.showBlocked)
          this.log("\x1b[37mBLOCKING: ", route.request().url(), "\x1b[0m")
        return route.abort()
      }
      return route.fallback()
    })

    // enable caching
    if (meta.useCache ?? true)
      await enableCacheForContext(this, `cache:${meta.name}`, meta.forceCacheUrls ?? [], { showCached: this.debugOptions.showCached, showUncached: this.debugOptions.showUncached })

    // create page for scraping
    this.page = await this.context.newPage()
    return scraper(this)
  }
}

const getIPAndTimezone = async (browser: Browser) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  const PROVIDERS = [
    { url: "https://json.geoiplookup.io", ip_field: "ip", tz_field: "timezone_name" },
    { url: "https://ipapi.co/json", ip_field: "ip", tz_field: "timezone" },
    { url: "https://ipinfo.io/json", ip_field: "ip", tz_field: "timezone" }
  ]
  const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)]

  const ret = await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: IPTZ_MAX_WAIT_MS })
    .then(async response => ({ ok: !!response, status: response?.status() ?? 0, out: await response?.text() ?? "" }))
    .finally(() => context.close())

  const json = JSON.parse(ret.out)
  const [ip, tz] = [json[provider.ip_field], json[provider.tz_field]] as [string | undefined, string | undefined]
  if (!ret.ok || !ip || !tz)
    throw new Error(`Failed to get ip/timezone (status ${ret.status}): ${ret.out}`)

  return { ip, tz }
}
