import c from "ansi-colors"
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
import * as dotenv from "dotenv"

export const BROWSERS: BrowserName[] = ["firefox", "webkit", "chromium"]
const IPTZ_MAX_WAIT_MS = 5000

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

  /** Pick the browser(s) to randomize between. Can be any array containing ["webkit", "firefox", "chromium"].
   * @default ["webkit", "firefox", "chromium"] */
  useBrowsers?: BrowserName[]

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

  /** Shows requests that are not cached (nor blocked). Useful for finding patterns to add to `forceCacheUrls`.
   * @default false */
  showUncached?: boolean,

  /** Shows browsers being created/destroyed by the pool
   * @default false */
  showBrowserDebug?: boolean,

  /** Will use a proxy server for all requests. Note that only HTTP/HTTPS proxies are supported for now.
   * @default true */
  useProxy?: boolean,

  showFullResponse?: string[],
  showFullRequest?: string[],

  /** Will pause after each run, useful for debugging. Server only.
   * @default false */
  pauseAfterRun?: boolean,

  /** Will pause after each error, useful for debugging. Server only.
   * @default false */
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

  /** Enables tracing and places the Playwright tracing .zip file in this directory.
   * @default undefined */
  tracingPath?: string

  /** Writes the trace to the cache instead of the filesystem. Note that `tracingPath` is still necessary, but will be
   * used as temporary storage.
   * @default false */
  cacheTracing?: boolean

  /** Only save/cache trace when there's an error.
   * @default true */
  tracingOnErrorOnly?: boolean
}

type PlaywrightProxy = { server: string, username: string, password: string }

export class Scraper {
  private static proxies
  private id: string = ""
  private filtersEngine?: FiltersEngine
  private proxy?: PlaywrightProxy
  private lastProxyGroup = "default"
  private ipInfo?: { ip: string, countryCode: string, tz: string }

  public browser?: Browser
  public context?: BrowserContext
  public page!: Page
  public cache?: Cache
  public logLines: string[] = []
  public stats?: Stats
  public failed: boolean = false

  constructor(private browserType: AugmentedBrowserLauncher, private debugOptions: DebugOptions) {}

  static {
    dotenv.config()
    this.proxies = Object.keys(process.env).reduce<Record<string, string[]>>((acc, k) => {
      if (!k.startsWith("PROXY_ADDRESS_"))
        return acc
      const groupName = k.replace("PROXY_ADDRESS_", "").toLowerCase()
      acc[groupName] = (process.env[k] ?? "").split(",")
      return acc
    }, {})

    chromium.use(StealthPlugin())
    const webkitStealth = StealthPlugin();
    ["navigator.webdriver", "user-agent-override"].forEach(e => webkitStealth.enabledEvasions.delete(e))
    webkit.use(webkitStealth)
    const firefoxStealth = StealthPlugin();
    ["user-agent-override"].forEach(e => firefoxStealth.enabledEvasions.delete(e))
    firefox.use(firefoxStealth)
  }

  async create() {
    const startTime = Date.now()
    if (this.debugOptions.showBrowserDebug)
      this.log(`creating ${c.green(this.browserType.name())} browser`)

    let retries = 0
    const sc = this
    const browser = await pRetry(() => this.createBrowserAttempt(), { retries: 5, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {
      retries += 1
      sc.failed = true
      await sc.destroy()
    }})
    sc.failed = false

    if (this.debugOptions.showBrowserDebug)
      this.log(`created browser in ${Date.now() - startTime}ms${retries > 0 ? ` (after ${retries + 1} attempts)` : "" }`)
    return browser
  }

  private async selectProxy(group: string) {
    if (!(this.debugOptions.useProxy ?? true)) {
      // Even though we're not using a proxy, we need to know our perceived timezone
      this.ipInfo = await getIPInfo(this.browser!, this.proxy)
      this.log(c.yellowBright(`Not using proxy server (useProxy option not enabled), tz is: ${this.ipInfo.tz}, country is: ${this.ipInfo.countryCode}`))
      return
    }

    const proxies = Scraper.proxies[group]
    if (!proxies || proxies.length === 0)
      throw new Error(`No proxies found for ${group}`)
    const selectedProxy = proxies[Math.floor(Math.random() * proxies.length)]

    const { host, username, password, protocol } = new URL(selectedProxy!)
    this.proxy = { server: `${protocol}//${host}`, username: username, password: password }

    // generate random proxy when using proxy services that have the password format define which ip to use
    const psPasswordRegexp = /(?<start>\S{16}_country-\S+_session-)\S{8}$/u.exec(password)
    if ((this.debugOptions.changeProxies ?? true) && psPasswordRegexp)
    this.proxy.password = psPasswordRegexp.groups!["start"] + Math.random().toString(36).slice(2).substring(0, 8)

    // Get current IP and timezone
    this.ipInfo = await getIPInfo(this.browser!, this.proxy)
    if (this.debugOptions.showBrowserDebug)
      this.log(c.magenta(`Using ${group} proxy group, resolving to timezone ${this.ipInfo.tz} and country ${this.ipInfo.countryCode}`))

    this.lastProxyGroup = group
  }

  async createBrowserAttempt() {
    // Start browser w/ default proxy
    this.browser = await this.browserType.launch({ headless: false })
    await this.selectProxy("default")

    // enable adblocking (assuming we're going to use them)
    const adblockCache = { path: "tmp/adblocker.bin", read: fs.readFile, write: fs.writeFile }
    this.filtersEngine = await FiltersEngine.fromLists(fetch, [
      "https://easylist.to/easylist/easylist.txt", "https://easylist.to/easylist/easyprivacy.txt", "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
      "https://easylist.to/easylist/fanboy-social.txt", "https://secure.fanboy.co.nz/fanboy-annoyance.txt", "https://easylist.to/easylist/easylist.txt",
      "https://cdn.jsdelivr.net/gh/badmojr/1Hosts@master/Xtra/adblock.txt"
    ], undefined, adblockCache)
  }

  public async runAttempt<ReturnType>(code: (sc: Scraper) => Promise<ReturnType>, meta: ScraperMetadata, id: string): Promise<ReturnType> {
    this.failed = false
    this.id = id

    // if there's a proxy for this scraper name, use it. note that this will slow down the scraper creation process
    // we'll need to re-validate the proxy
    const extraProxies = Scraper.proxies[meta.name]
    if (extraProxies && extraProxies.length > 0) {
      if (this.lastProxyGroup !== meta.name)
        await this.selectProxy(meta.name)

    } else {
      if (this.lastProxyGroup !== "default")
        await this.selectProxy("default")
    }

    // generate random user agent
    const userAgent = meta.randomizeUserAgent ? new UserAgent({
      "webkit": { vendor: "Apple Computer, Inc.", deviceCategory: "desktop" },
      "chromium": { vendor: "Google Inc.", deviceCategory: "desktop" },
      "firefox": [/Firefox/u, { deviceCategory: "desktop" }]
    }[this.browserType.name()]).toString() : undefined

    // generate window and viewport sizes
    const SCREEN_SIZES = [[1920, 1080], [1536, 864], [2560, 1440], [1680, 1050], [1792, 1120], [1600, 900]]
    const screenSize = SCREEN_SIZES[Math.floor(Math.random() * SCREEN_SIZES.length)]!
    const screen = { width: screenSize[0]!, height: screenSize[1]! }
    const viewport = { width: Math.ceil(screen.width * (Math.random() * 0.2 + 0.8)), height: Math.ceil(screen.height * (Math.random() * 0.2 + 0.8)) }

    // create the context
    if (this.debugOptions.showProxyUrl)
      this.log(c.magenta("Using proxy server:"), this.proxy)
    this.context = await this.browser!.newContext({ timezoneId: this.ipInfo!.tz, locale: `en-${this.ipInfo!.countryCode}`,
      userAgent, proxy: this.proxy, ignoreHTTPSErrors: true, viewport, screen })

    if (this.debugOptions.tracingPath ?? undefined)
      await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true, title: id })
    this.context.setDefaultNavigationTimeout(15000)
    this.context.setDefaultTimeout(15000)

    // disable webrtc
    if (this.browserType.name() === "webkit") {
      await this.context.addInitScript("window.RTCPeerConnection = undefined;")
    } else {
      await this.context.addInitScript("navigator.mediaDevices.getUserMedia = navigator.webkitGetUserMedia = navigator.mozGetUserMedia = navigator.getUserMedia = webkitRTCPeerConnection = RTCPeerConnection = MediaStreamTrack = undefined;")
    }

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

  public async release() {
    if (!(this.debugOptions.tracingOnErrorOnly ?? true) || (this.debugOptions.tracingOnErrorOnly ?? true) && this.failed) {
      if (this.debugOptions.tracingPath ?? undefined) {
        if (this.id) {
          await this.context?.tracing.stop({ path: `${this.debugOptions.tracingPath}/${this.id}.zip` })
          if (this.debugOptions.cacheTracing ?? false) {
            const zip = await fs.readFile(`${this.debugOptions.tracingPath}/${this.id}.zip`)
            await this.cache?.insertIntoCache(`tracing:${this.id}`, zip, 60 * 60 * 24)  // 1 day
            this.log(c.magenta(`Saved trace to cache: tracing:${this.id}`))
            await fs.unlink(`${this.debugOptions.tracingPath}/${this.id}.zip`)
          } else {
            this.log(c.magenta(`Saved trace to: ${this.debugOptions.tracingPath}/${this.id}.zip`))
          }
        } else {
          await this.context?.tracing.stop()
        }
      }
    }

    if (this.stats)
      await this.stats.stop()
    await this.context?.unroute("*")
    if (this.cache)
      await this.cache.stop()

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    for (const page of this.context?.pages() ?? [])
      await page.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close page") })

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.context) await this.context.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close context") })
  }

  public async destroy() {
    if (this.debugOptions.showBrowserDebug)
      this.log("destroying context and browser")

    await this.release()

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

const getIPInfo = async (browser: Browser, proxy?: PlaywrightProxy) => {
  const context = await browser.newContext({ proxy })
  const page = await context.newPage()

  const PROVIDERS = [ "https://json.geoiplookup.io", "https://ipinfo.io/json", "http://ip-api.com/json/",
    "https://ipapi.co/json", "http://ifconfig.co/json", "https://ifconfig.es/json" ]    // these three use maxmind and are possibly inaccurate (199.249.230.22 should be texas)
  const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)]!

  const ret = await page.goto(provider, { waitUntil: "domcontentloaded", timeout: IPTZ_MAX_WAIT_MS })
    .then(async response => ({ ok: !!response, status: response?.status() ?? 0, out: await response?.text() ?? "" }))
    .finally(() => context.close())

  const json = JSON.parse(ret.out)
  const [ip, tz, countryCode] = [json.ip ?? json.query, json.timezone ?? json.timezone_name ?? json.time_zone, json.country_code ?? json.country] as [string | undefined, string | undefined, string | undefined]
  if (!ret.ok || !ip || !tz || !countryCode)
    throw new Error(`Failed to get ip/timezone (status ${ret.status}): ${ret.out}`)

  return { ip, tz, countryCode }
}
