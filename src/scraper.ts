import c from "ansi-colors"
import pRetry from "p-retry"
// import UserAgent from "user-agents"
// import { promises as fs } from "fs" // used for caching

import { logger, prettifyArgs } from "./log.js"
// import globToRegexp from "glob-to-regexp"
// import { Cache } from "./cache.js"
import * as dotenv from "dotenv"
import util from "util"
import dayjs from "dayjs"
import { CDPBrowser } from "./cdp-browser.js"

const IPTZ_MAX_WAIT_MS = 5000

export type ScraperMetadata = {
  /** Unique name for the scraper */
  name: string,

  /** Blocks urls. Can contain *s to match.
   * @example ["google-analytics.com"]
   * @default [] */
  blockUrls: string[]

  /** Some websites don't return proper cache headers, this forces matching globs/RegExps to get cached. Use the
   * `showUncached` debug option to iterate. Does not work if `useCache` is set to `false`.
   * @default [] */
  //forceCacheUrls: (string | RegExp)[]

  /** Caching is on by default, but can be turned off using this flag. This will make requests much slower, but could
   * catch certain improperly configured servers. `forceCacheUrls` will not work if this is set to `false`.
   * @default true */
  //useCache: boolean

  /** Picks a random useragent that matches the browser type that's launched. Note that enabling this could enable faster
   * detection of the botting if the anti-bot is checking for certain browser features.
   * @default false */
  //fakeUserAgent: boolean

  /** Set the default timeout for navigation and selector requests.
   * @default 15000 */
  defaultTimeout?: number
}
const defaultScraperMetadata: Required<ScraperMetadata> = {
  name: "default", defaultTimeout: 15000, blockUrls: []
}

export type DebugOptions = {
  /** Shows request urls
   * @default false */
  showRequests: boolean,

  /** Shows the full request data that was received (uses url globs)
     * @default [] */
  showFullRequest: string[],

  /** Shows respone metadata
   * @default false */
  showResponses: boolean,

  /** Shows the full response data that was received (uses url globs)
   * @default [] */
  showFullResponse: string[],

  /** Shows requests which were blocked due to `blockUrls`
   * @default false */
  showBlocked: boolean,

  /** Shows requests which were retrieved from cache
   * @default false */
  showCached: boolean,

  /** Shows requests that are not cached (nor blocked). Useful for finding patterns to add to `forceCacheUrls`.
   * @default false */
  showUncached: boolean,

  /** Shows browsers being created/destroyed by the pool
   * @default false */
  showBrowserDebug: boolean,

  /** Will use a proxy server for all requests. Note that only HTTP/HTTPS proxies are supported for now.
   * @default true */
  useProxy: boolean,

  /** Will pause after each run, useful for debugging. Server only.
   * @default false */
  pauseAfterRun: boolean,

  /** Will pause after each error, useful for debugging. Server only.
   * @default false */
  pauseAfterError: boolean,

  /** When using a proxy service that has it's passwords in the format: `/\S{16}_country-\S+_session-)\S{8}$/`, we'll
   * randomize text for those last 8 characters which should get a new proxy. This happens every time a new browser is
   * opened (so not on retries).
   * @default true */
  changeProxies: boolean

  /** If a scraper fails, we'll retry until this many attempts.
   * @default 3 */
  maxAttempts: number

  /** When debugging, it might be useful to show the proxy URL (with username/password)
   * @default false */
  showProxyUrl: boolean
}
const defaultDebugOptions: DebugOptions = {
  showRequests: false, showFullRequest: [], showResponses: false, showFullResponse: [], showBlocked: false,
  showCached: false, showUncached: false, showBrowserDebug: true, useProxy: true, pauseAfterRun: false,
  pauseAfterError: false, changeProxies: true, maxAttempts: 3, showProxyUrl: false
}

export class Scraper {
  public browser: CDPBrowser

  private debugOptions: DebugOptions
  private scraperMeta!: Required<ScraperMetadata>

  private static proxies
  private id: string = ""
  //private proxy?: PlaywrightProxy
  private lastProxyGroup = "default"
  private ipInfo?: { ip: string, countryCode: string, tz: string }
  private attemptStartTime!: number


  // public browser?: Browser
  // public context?: BrowserContext
  // public page!: Page
  // public cache?: Cache
  public logLines: string[] = []
  public failed: boolean = false

  constructor(debugOptions: Partial<DebugOptions>) {
    this.debugOptions = {...defaultDebugOptions, ...debugOptions}
    this.browser = new CDPBrowser()
    this.browser.on("message", this.log.bind(this))
  }

  static {
    dotenv.config()
    this.proxies = Object.keys(process.env).reduce<Record<string, string[]>>((acc, k) => {
      if (!k.startsWith("PROXY_ADDRESS_"))
        return acc
      const groupName = k.replace("PROXY_ADDRESS_", "").toLowerCase()
      acc[groupName] = (process.env[k] ?? "").split(",")
      return acc
    }, {})
  }

  // async create() {
  //   const startTime = Date.now()
  //   if (this.debugOptions.showBrowserDebug)
  //     this.log("creating browser")

  //   let retries = 0
  //   const sc = this // TODO: might be unnecessary and can properly use bind
  //   const browser = await pRetry(() => this.createBrowserAttempt(), { retries: this.debugOptions.maxAttempts! - 1, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {
  //     retries += 1
  //     await sc.destroy()
  //   }})

  //   if (this.debugOptions.showBrowserDebug)
  //     this.log(`created browser in ${Date.now() - startTime}ms${retries > 0 ? ` (after ${retries + 1} attempts)` : "" }`)
  //   return browser
  // }

  // private async selectProxy(group: string) {
  //   if (!this.debugOptions.useProxy) {
  //     // Even though we're not using a proxy, we need to know our perceived timezone
  //     this.ipInfo = await getIPInfo(this.browser, this.proxy)
  //     this.log(c.yellowBright(`Not using proxy server (useProxy option not enabled), tz is: ${this.ipInfo.tz}, country is: ${this.ipInfo.countryCode}`))
  //     return
  //   }

  //   const proxies = Scraper.proxies[group]
  //   if (!proxies || proxies.length === 0)
  //     throw new Error(`No proxies found for ${group}`)
  //   const selectedProxy = proxies[Math.floor(Math.random() * proxies.length)]

  //   const { host, username, password, protocol } = new URL(selectedProxy!)
  //   this.proxy = { server: `${protocol}//${host}`, username: username, password: password }

  //   // generate random proxy when using proxy services that have the password format define which ip to use
  //   const psPasswordRegexp = /(?<start>\S{16}_country-\S+_session-)\S{8}$/u.exec(password)
  //   if ((this.debugOptions.changeProxies ?? true) && psPasswordRegexp)
  //   this.proxy.password = psPasswordRegexp.groups!["start"] + Math.random().toString(36).slice(2).substring(0, 8)

  //   // Get current IP and timezone
  //   this.ipInfo = await getIPInfo(this.browser!, this.proxy)
  //   if (this.debugOptions.showBrowserDebug)
  //     this.log(c.magenta(`Using ${group} proxy group, resolving to timezone ${this.ipInfo.tz} and country ${this.ipInfo.countryCode}`))

  //   this.lastProxyGroup = group
  // }

  // async createBrowserAttempt() {
  //   // Start browser w/ default proxy
  //   await this.browser.launch()
  //   // await this.selectProxy("default")
  // }

  private logAttemptResult() {
    logger.log(this.failed ? "error" : "info", this.logLines.join("\n"), {
      labels: {
        type: "scraper-run",
        scraper_name: this.scraperMeta.name,
        start_unix: this.attemptStartTime,
        id: this.id,
        duration_ms: Date.now() - this.attemptStartTime,
        status: this.failed ? "failure" : "success",
      },
      noConsole: true,
    })
  }

  public async run<ReturnType>(code: (sc: Scraper) => Promise<ReturnType>, meta: ScraperMetadata, id: string) {
    const startTime = Date.now()

    this.id = id
    this.scraperMeta = { ...defaultScraperMetadata, ...meta }
    this.logLines = []

    const sc = this   // TODO: might be unnecessary
    const attemptResult = await pRetry(() => {
      return this.runAttempt(code)

    }, { retries: this.debugOptions.maxAttempts! - 1, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {
      const fullError = prettifyArgs([c.red("Ending scraper due to error"), error])
      const timestampedError = fullError.split("\n").map(errLine => `[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${errLine}`).join("\n")
      sc.logLines.push(timestampedError)

      if (sc.debugOptions.pauseAfterError) {
        sc.log(error)
        await sc.pause()
      }
      sc.log(c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))

    }}).catch(async e => {    // failed all retries
      sc.log(c.red(`All retry attempts exhausted: ${e.message}`))
      return undefined

    }).finally(() => {
      this.logAttemptResult()
    })

    this.log(`completed ${!attemptResult ? c.red("in failure ") : ""}in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${this.browser.stats().summary})`)
    return { result: attemptResult, logLines: this.logLines }
  }

  // Note that the browser might be shared coming into here (i.e. we don't get a new proxy). We only destroy the browser
  // if a scraper fails.
  private async runAttempt<ReturnType>(code: (sc: Scraper) => Promise<ReturnType>): Promise<ReturnType> {
    // if there's a proxy for this scraper name, use it. note that this will slow down the scraper creation process
    // we'll need to re-validate the proxy
    // const extraProxies = Scraper.proxies[this.scraperMeta.name]
    // if (extraProxies && extraProxies.length > 0) {
    //   if (this.lastProxyGroup !== this.scraperMeta.name)
    //     await this.selectProxy(this.scraperMeta.name)

    // } else {
    //   if (this.lastProxyGroup !== "default")
    //     await this.selectProxy("default")
    // }
    const proxy = "" // TODO: do it

    // TODO: generate random user agent
    // const userAgent = this.scraperMeta.fakeUserAgent
    //   ? new UserAgent({ vendor: "Google Inc.", deviceCategory: "desktop" }).toString()
    //   : undefined

    // generate window and viewport sizes
    // const SCREEN_SIZES = [[1920, 1080], [1536, 864], [2560, 1440], [1680, 1050], [1792, 1120], [1600, 900]]
    // const screenSize = SCREEN_SIZES[Math.floor(Math.random() * SCREEN_SIZES.length)]!
    // const screen = { width: screenSize[0]!, height: screenSize[1]! }
    // const viewport = { width: Math.ceil(screen.width * (Math.random() * 0.2 + 0.8)), height: Math.ceil(screen.height * (Math.random() * 0.2 + 0.8)) }

    // create the context
    if (this.debugOptions.showProxyUrl)
      this.log(c.magenta("Using proxy server:"), proxy)
    await this.browser.launch()   // TODO: timezone, locale, useragent, proxy, viewport, screen
    // await this.browser!.newContext({ timezoneId: this.ipInfo!.tz, locale: `en-${this.ipInfo!.countryCode}`,
    //   userAgent, proxy: this.proxy, ignoreHTTPSErrors: true, viewport, screen })

    // use timeouts
    this.browser.defaultTimeoutMs = this.scraperMeta.defaultTimeout

    // TODO: disable webrtc or do it right

    // TODO: debugging options to see requests and responses (and optionally the full bodies)
    // if (this.debugOptions.showRequests)
    //   this.context.on("request", request => this.log(">>", request.method(), request.url()))
    // if (this.debugOptions.showResponses)
    //   this.context.on("response", async response => this.log("<<", response.status(), response.url(), await response.headerValue("cache-control")))

    // TODO: full request responses
    // const fullRequestRegexps = (this.debugOptions.showFullRequest ?? []).map((glob) => globToRegexp(glob, { extended: true }))
    // fullRequestRegexps.length > 0 && this.context.on("request", async (request) => {
    //   if (fullRequestRegexps.some((pattern) => pattern.test(request.url()))) {
    //     this.log("\n", c.whiteBright(`*** Outputting request for ${request.url()} ***`), "\n",
    //       c.whiteBright(request.postData() ?? "(no post data)"), "\n", c.whiteBright("*******"))
    //   }
    // })

    // const fullResponseRegexps = (this.debugOptions.showFullResponse ?? []).map((glob) => globToRegexp(glob, { extended: true }))
    // fullResponseRegexps.length > 0 && this.context.on("response", async (response) => {
    //   if (fullResponseRegexps.some((pattern) => pattern.test(response.url()))) {
    //     this.log("\n", c.whiteBright(`*** Outputting response for ${response.url()} ***`), "\n",
    //       c.whiteBright(await response.text()), "\n", c.whiteBright("*******"))
    //   }
    // })

    if (this.scraperMeta.blockUrls.length > 0)
      await this.browser.blockUrls(this.scraperMeta.blockUrls)

    // TODO: showblocked
    // await this.context.route("**/*", route => {
    //   const adblockReq = fromPlaywrightDetails(route.request())
    //   const engineMatch = this.filtersEngine?.match(adblockReq)
    //   if (engineMatch?.match) {
    //     if (this.debugOptions.showBlocked)
    //       this.log("\x1b[37mBLOCKING: ", route.request().url(), "\x1b[0m")
    //     return route.abort()
    //   }
    //   return route.fallback()
    // })

    // TODO: enable caching
    // if (this.scraperMeta.useCache ?? true) {
    //   this.cache = new Cache(this, `cache:${this.scraperMeta.name}`, this.scraperMeta.forceCacheUrls ?? [], this.debugOptions)
    //   await this.cache.start()
    // }

    // create page for scraping
    // this.page = await this.context.newPage()
    // TODO::set per-scraper timeouts
    // this.page.setDefaultTimeout(this.scraperMeta.defaultTimeout ?? 15000)
    // this.page.setDefaultNavigationTimeout(this.scraperMeta.defaultTimeout ?? 15000)
    const result = await code(this)

    if (this.debugOptions.pauseAfterRun)
      await this.pause()

    return result
  }

  public async release() {
    // TODO: all this

    // if (!(this.debugOptions.tracingOnErrorOnly ?? true) || (this.debugOptions.tracingOnErrorOnly ?? true) && this.failed) {
    //   if (this.debugOptions.tracingPath ?? undefined) {
    //     if (this.id) {
    //       await this.context?.tracing.stop({ path: `${this.debugOptions.tracingPath}/${this.id}.zip` })
    //       if (this.debugOptions.cacheTracing ?? false) {
    //         const zip = await fs.readFile(`${this.debugOptions.tracingPath}/${this.id}.zip`)
    //         await this.cache?.insertIntoCache(`tracing:${this.id}`, zip, 60 * 60 * 24)  // 1 day
    //         this.log(c.magenta(`Saved trace to cache: ${this.id}`))
    //         await fs.unlink(`${this.debugOptions.tracingPath}/${this.id}.zip`)
    //       } else {
    //         this.log(c.magenta(`Saved trace to: ${this.debugOptions.tracingPath}/${this.id}.zip`))
    //       }
    //     } else {
    //       await this.context?.tracing.stop()
    //     }
    //   }
    // }

    // if (this.stats)
    //   await this.stats.stop()
    // await this.context?.unroute("*")
    // if (this.cache)
    //   await this.cache.stop()

    // // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    // for (const page of this.context?.pages() ?? [])
    //   await page.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close page") })

    // // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    // if (this.context) await this.context.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close context") })
  }

  public async destroy() {
    if (this.debugOptions.showBrowserDebug)
      this.log("destroying context and browser")

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.browser) await this.browser.close().catch(() => { if (this.debugOptions.showBrowserDebug) this.log("DESTROY: failed to close browser") })
  }

  /////////////////////////////////////////
  /////////////////////////////////////////

  public log(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    this.logLines.push(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${prettyLine}`)
    logger.info(prettyLine, { id: this.id })
  }

  public async pause() {
    this.log(c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8282/vnc.html) ***")))
    // eslint-disable-next-line no-restricted-globals
    await new Promise((resolve) => setTimeout(resolve, 10000000))
  }
}

// const getIPInfo = async (browser: Browser, proxy?: PlaywrightProxy) => {
//   const context = await browser.newContext({ proxy })
//   const page = await context.newPage()

//   const PROVIDERS = [ "https://json.geoiplookup.io", "https://ipinfo.io/json", "http://ip-api.com/json/",
//     "https://ipapi.co/json", "http://ifconfig.co/json", "https://ifconfig.es/json" ]    // these three use maxmind and are possibly inaccurate (199.249.230.22 should be texas)
//   const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)]!

//   const ret = await page.goto(provider, { waitUntil: "domcontentloaded", timeout: IPTZ_MAX_WAIT_MS })
//     .then(async response => ({ ok: !!response, status: response?.status() ?? 0, out: await response?.text() ?? "" }))
//     .finally(() => context.close())

//   const json = JSON.parse(ret.out)
//   const [ip, tz, countryCode] = [json.ip ?? json.query, json.timezone ?? json.timezone_name ?? json.time_zone, json.country_code ?? json.country] as [string | undefined, string | undefined, string | undefined]
//   if (!ret.ok || !ip || !tz || !countryCode)
//     throw new Error(`Failed to get ip/timezone (status ${ret.status}): ${ret.out}`)

//   return { ip, tz, countryCode }
// }
