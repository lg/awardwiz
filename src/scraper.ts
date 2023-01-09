import { env } from "node:process"
import c from "ansi-colors"
import url from "url"
import pRetry from "p-retry"
import { Browser, BrowserContext, Page } from "playwright"
import UserAgent from "user-agents"
import { promises as fs } from "fs" // used for caching
import { FiltersEngine, fromPlaywrightDetails, NetworkFilter } from "@cliqz/adblocker-playwright"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { AugmentedBrowserLauncher, chromium, firefox, webkit } from "playwright-extra"
import fetch from "cross-fetch"
import { logWithId } from "./log.js"
import globToRegexp from "glob-to-regexp"
import { Cache } from "./cache.js"
import { Stats } from "./stats.js"

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

  /** Picks a random useragent that matches the browser type that's launched. Note that enabling this could enable faster
   * detection of the botting if the anti-bot is checking for certain browser features.
   * @default false */
  randomizeUserAgent?: boolean
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
   * @default 3 */
  maxAttempts?: number

  /** Minimum number of browsers of each type to keep in the pool.
   * @default 2 */
  minBrowserPool?: number

  /** Maximum number of browsers of each type to keep in the pool.
   * @default 3 */
  maxBrowserPool?: number

  /** When debugging, it might be useful to show the proxy URL (with username/password)
   * @default false */
  showProxyUrl?: boolean

  /** Normally cache is saved on it's own schedule, but especially when debugging, sometimes the cache server is run
   * adhoc and never gets a chance to save, this will save after each set call. This is not recommended for production.
   * @default false */
  saveAfterCaching?: boolean
}

type PlaywrightProxy = { server: string, username: string, password: string }

export class Scraper {
  private id: string = ""
  private debugOptions: DebugOptions
  private filtersEngine?: FiltersEngine
  private browserType: AugmentedBrowserLauncher
  private proxy?: PlaywrightProxy
  private tz?: string

  public browser?: Browser
  public context?: BrowserContext
  public page!: Page
  public cache?: Cache
  public logLines: string[] = []
  public stats?: Stats

  static {
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
    const browser = await pRetry(() => this.createBrowserAttempt(), { retries: 5, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {
      retries += 1
      await sc.destroy(error.message.split("\n")[0])
    }})

    if (this.debugOptions.showBrowserDebug)
      this.log(`created browser in ${Date.now() - startTime}ms${retries > 0 ? ` (after ${retries + 1} attempts)` : "" }`)
    return browser
  }

  async createBrowserAttempt() {
    // Start browser
    this.browser = await this.browserType.launch({ headless: false })

    // Select a proxy
    const proxies = env.PROXY_ADDRESS?.split(",")
    const selectedProxy = proxies ? proxies[Math.floor(Math.random() * proxies.length)] : undefined
    if ((this.debugOptions.useProxy ?? true) && selectedProxy && url.parse(selectedProxy).hostname !== null) {
      const { host, username, password, protocol } = new URL(selectedProxy)
      this.proxy = { server: `${protocol}//${host}`, username: username, password: password }

      // generate random proxy
      const psPasswordRegexp = /(?<start>\S{16}_country-\S+_session-)\S{8}$/u.exec(password)
      if ((this.debugOptions.changeProxies ?? true) && psPasswordRegexp)
        this.proxy.password = psPasswordRegexp.groups!.start + Math.random().toString(36).slice(2).substring(0, 8)
    } else {
      if (this.debugOptions.showBrowserDebug)
        this.log(c.yellow(`Not using proxy server ${!(this.debugOptions.useProxy ?? true) ? "(useProxy option not enabled)" : `(${env.PROXY_ADDRESS === undefined ? "missing" : "invalid"})` }`))
    }

    // Get current IP and timezone
    const { tz } = await getIPAndTimezone(this.browser, this.proxy)
    this.tz = tz
    if (this.debugOptions.showBrowserDebug)
      this.log(c.magenta(`IP resolved to timezone ${this.tz}`))

    // enable adblocking (assuming we're going to use them)
    const adblockCache = { path: "tmp/adblocker.bin", read: fs.readFile, write: fs.writeFile }
    this.filtersEngine = await FiltersEngine.fromLists(fetch, [
      "https://easylist.to/easylist/easylist.txt", "https://easylist.to/easylist/easyprivacy.txt", "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
      "https://easylist.to/easylist/fanboy-social.txt", "https://secure.fanboy.co.nz/fanboy-annoyance.txt", "https://easylist.to/easylist/easylist.txt",
      "https://cdn.jsdelivr.net/gh/badmojr/1Hosts@master/Xtra/adblock.txt"
    ], undefined, adblockCache)
  }

  public async runAttempt<ReturnType>(code: (sc: Scraper) => Promise<ReturnType>, meta: ScraperMetadata, id: string): Promise<ReturnType> {
    this.id = id

    // generate random user agent
    const userAgent = meta.randomizeUserAgent ? new UserAgent({
      "webkit": { vendor: "Apple Computer, Inc.", deviceCategory: "desktop" },
      "chromium": { vendor: "Google Inc.", deviceCategory: "desktop" },
      "firefox": [/Firefox/u, { deviceCategory: "desktop" }]
    }[this.browserType.name()]).toString() : undefined

    // generate window and viewport sizes
    const SCREEN_SIZES = [[1920, 1080], [1366, 768], [1440, 900], [1536, 864], [2560, 1440], [1680, 1050], [1280, 720], [1280, 800], [1792, 1120], [1600, 900]]
    const screenSize = SCREEN_SIZES[Math.floor(Math.random() * SCREEN_SIZES.length)]
    const screen = { width: screenSize[0], height: screenSize[1] }
    const viewport = { width: Math.ceil(screen.width * (Math.random() * 0.3 + 0.7)), height: Math.ceil(screen.height * (Math.random() * 0.3 + 0.7)) }

    // create the context
    if (this.debugOptions.showProxyUrl)
      this.log(c.magenta("Using proxy server:"), this.proxy)
    this.context = await this.browser!.newContext({ serviceWorkers: "block", timezoneId: this.tz, locale: "en-US",
      userAgent, proxy: this.proxy, ignoreHTTPSErrors: true, viewport, screen })
    this.context.setDefaultNavigationTimeout(15000)
    this.context.setDefaultTimeout(15000)

    // enable stats
    this.stats = new Stats(this)

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

    // enable blocking urls (and add extra urls requested by scraper)
    if (!(meta.useAdblockLists ?? true))
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
    if (meta.useCache ?? true) {
      this.cache = new Cache(this, `cache:${meta.name}`, meta.forceCacheUrls ?? [], this.debugOptions)
      await this.cache.start()
    }

    // create page for scraping
    this.page = await this.context.newPage()
    const result = await code(this)

    if (this.debugOptions.pauseAfterRun)
      await this.pause()

    return result
  }

  public async destroy(debugReason: string = "") {
    if (this.debugOptions.showBrowserDebug)
      this.log(`destroying context and browser${debugReason ? ` (called because: ${debugReason})` : ""}`)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    for (const page of this.context?.pages() ?? [])
      await page.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close page") })

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.context) await this.context.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close context") })
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.browser) await this.browser.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close browser") })
  }

  /////////////////////////////////////////
  /////////////////////////////////////////

  public log(...args: any[]) {
    logWithId(this.id, ...args)
  }

  public async pause() {
    this.log(c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8282/vnc.html) ***")))
    await this.page.pause()
  }
}

const getIPAndTimezone = async (browser: Browser, proxy?: PlaywrightProxy) => {
  const context = await browser.newContext({ proxy })
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
