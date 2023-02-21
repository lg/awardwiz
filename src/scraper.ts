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
import { exec } from "node:child_process"

const IPTZ_MAX_WAIT_MS = 5000

export type ScraperMetadata = {
  /** Unique name for the scraper */
  name: string,

  /** Blocks urls. Can contain *s to match.
   * @example ["google-analytics.com"]
   * @default [] */
  blockUrls?: string[]

  /** Set the default timeout for navigation and selector requests.
   * @default 15000 */
  defaultTimeout?: number

  /** Items will be cached globally (i.e. across all running instances) if this is true. Set to false to not store.
   * @default true */
  useGlobalCache?: boolean
}
const defaultScraperMetadata: Required<ScraperMetadata> = {
  name: "default", defaultTimeout: 15000, blockUrls: [], useGlobalCache: true
}

export type DebugOptions = {
  /** Will use a proxy server for all requests. Note that only HTTP/HTTPS proxies are supported for now.
   * @default true */
  useProxy: boolean,

  /** Will pause after each run, useful for debugging. Server only.
   * @default false */
  pauseAfterRun: boolean,

  /** Will pause after each error, useful for debugging. Server only.
   * @default false */
  pauseAfterError: boolean,

  /** If a scraper fails, we'll retry until this many attempts.
   * @default 3 */
  maxAttempts?: number

  /** Use this directory for shared global cache. Mount this as a volume to share between instances.
   * @default "./tmp/cache" */
  globalCacheDir?: string

  /** Display stdout/stderr from the browser process. Can be true/false or "verbose"
   * @default false */
  browserDebug?: boolean | "verbose"
}
const defaultDebugOptions: Required<DebugOptions> = {
  maxAttempts: 3, pauseAfterError: false, pauseAfterRun: false, useProxy: true, globalCacheDir: "./tmp/cache",
  browserDebug: false
}

export class Scraper {
  public browser: CDPBrowser

  private debugOptions: Required<DebugOptions>
  private scraperMeta!: Required<ScraperMetadata>

  private static proxies: Record<string, string[]> = {}
  private id: string = ""
  private attemptStartTime!: number

  public logLines: string[] = []
  public failed: boolean = false

  constructor(debugOptions: Partial<DebugOptions>) {
    this.debugOptions = {...defaultDebugOptions, ...debugOptions}
    this.browser = new CDPBrowser()
    this.browser.on("message", this.log.bind(this))
    if (debugOptions.browserDebug)
      this.browser.on("browser_message", this.log.bind(this))
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

    const sc = this
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

    }).finally(async () => {
      this.logAttemptResult()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.browser)
        await this.browser.close().catch(() => {})
    })

    this.log(`completed ${!attemptResult ? c.red("in failure ") : ""}in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${this.browser.stats().summary})`)
    return { result: attemptResult, logLines: this.logLines }
  }

  // Note that the browser might be shared coming into here (i.e. we don't get a new proxy). We only destroy the browser
  // if a scraper fails.
  private async runAttempt<ReturnType>(code: (sc: Scraper) => Promise<ReturnType>): Promise<ReturnType> {
    // Set up the proxy server
    let proxy: string | undefined = undefined
    if (this.debugOptions.useProxy) {
      const proxies = Scraper.proxies[this.scraperMeta.name] ?? Scraper.proxies["default"]
      if ((proxies ?? []).length > 0) {
        proxy = proxies![Math.floor(Math.random() * proxies!.length)]
        this.log(c.magentaBright(`Using proxy server: ${proxy}`))
      } else {
        this.log(c.yellowBright("Not using proxy server!"))
      }
    }

    // Randomize a window size depending on the screen resolution
    const screenResolution = await new Promise<number[] | undefined>(resolve => {   // will return array of [width, height]
      exec("xdpyinfo | grep dimensions", (err, stdout) =>
        resolve(/ (?<res>\d+x\d+) /u.exec(stdout)?.[0].trim().split("x").map(num => parseInt(num)) ?? undefined))
    })
    let windowSize: number[] | undefined = undefined
    let windowPos: number[] | undefined = undefined
    if (screenResolution) {
      windowSize = [Math.ceil(screenResolution[0]! * (Math.random() * 0.2 + 0.8)), Math.ceil(screenResolution[1]! * (Math.random() * 0.2 + 0.8))]
      windowPos = [Math.ceil((screenResolution[0]! - windowSize[0]!) * Math.random()), Math.ceil((screenResolution[1]! - windowSize[1]!) * Math.random())]
    }

    // Start the browser
    await this.browser.launch({
      proxy,
      useGlobalCache: this.scraperMeta.useGlobalCache,
      globalCacheDir: this.debugOptions.globalCacheDir,
      windowSize,
      windowPos,
      browserDebug: this.debugOptions.browserDebug,
    })

    // use timeouts
    this.browser.defaultTimeoutMs = this.scraperMeta.defaultTimeout

    // block requested URLs
    if (this.scraperMeta.blockUrls.length > 0)
      await this.browser.blockUrls(this.scraperMeta.blockUrls)

    const result = await code(this)

    if (this.debugOptions.pauseAfterRun)
      await this.pause()

    return result
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
