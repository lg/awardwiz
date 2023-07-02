import CDP from "chrome-remote-interface"
import c from "ansi-colors"
import dayjs from "dayjs"
import util from "util"
import winston from "winston"
import pRetry from "p-retry"
import { arkalisRequests } from "./requests.js"
import { arkalisInterceptor } from "./interceptor.js"
import { arkalisProxy } from "./proxy.js"
import { arkalisBrowser } from "./browser.js"
import { arkalisPageHelpers } from "./page-helpers.js"
import { arkalisInteraction } from "./interaction.js"
import { arkalisResponseCache } from "./response-cache.js"

export type ScraperMetadata = {
  /** Unique name for the scraper */
  name: string,

  /** Blocks urls. Can contain *s to match.
   * @example ["google-analytics.com"]
   * @default [] */
  blockUrls?: string[]

  /** Set the default timeout for navigation and selector requests.
   * @default 30000 */
  defaultTimeoutMs?: number

  /** Browser resources will be cached globally (i.e. across all running instances) if this is true. Set to false to
   * not store.
   * @default true */
  useGlobalBrowserCache?: boolean

  /** Amount of miliseconds to cache the results for (TTL). Set to 0 to not cache. Set to null to use the configured
   * default (defaultResultCacheTtl).
   * @default undefined */
  resultCacheTtlMs?: number | null
}
export const defaultScraperMetadata: Required<ScraperMetadata> = {
  name: "default", defaultTimeoutMs: 30000, blockUrls: [], useGlobalBrowserCache: true, resultCacheTtlMs: null
}

export type DebugOptions = {
  /** Will use a proxy server for all requests. Note that only HTTP/HTTPS proxies are supported for now.
   * @default true */
  useProxy?: boolean,

  /** Will pause after each run, useful for debugging. Server only.
   * @default false */
  pauseAfterRun?: boolean,

  /** Will pause after each error, useful for debugging. Server only.
   * @default false */
  pauseAfterError?: boolean,

  /** If a scraper fails, we'll retry until this many attempts.
   * @default 3 */
  maxAttempts?: number

  /** Use this directory for shared global browser cache. Mount this as a volume to share between instances.
   * @default "./tmp/browser-cache" */
  globalBrowserCacheDir?: string

  /** Display stdout/stderr from the browser process. Can be true/false or "verbose"
   * @default false */
  browserDebug?: boolean | "verbose"

  /** Draws the mouse path when clicking on things
   * @default false */
  drawMousePath?: boolean

  /** Timezone in America/Los_Angeles format. If not set, will use the system timezone unless a proxy is used and the
   * PROXY_TZ_SCRAPERNAME or fallback PROXY_TZ_DEFAULT is set.
   * @default null */
  timezone?: string | null

  /** Show requests and their browser cache status.
   * @default true */
  showRequests?: boolean

  /** Custom logger. If not set, will use the general console logger. If null, will not log outside of logLines.
   * @default console.log */
  liveLog?: ((prettyLine: string, id: string) => void) | null

  /** Custom logger for the final result with metadata of the run.
   * @default null */
  winston?: winston.Logger | null

  /** Path to store cache of items like results. If not set, will not use a cache.
   * @default null */
  globalCachePath?: string | null

  /** Set to enable result cache
   * @default false */
  useResultCache?: boolean

  /** Set the default TTL (in seconds) for the result cache. Set to 0 to not cache by default.
   * @default 0 */
  defaultResultCacheTtl?: number
}
export const defaultDebugOptions: Required<DebugOptions> = {
  maxAttempts: 3, pauseAfterError: false, pauseAfterRun: false, useProxy: true, browserDebug: false, winston: null,
  globalBrowserCacheDir: "./tmp/browser-cache", globalCachePath: null, drawMousePath: false,
  timezone: null, showRequests: true, useResultCache: false, defaultResultCacheTtl: 0,
  liveLog: (prettyLine: string) => { /* eslint-disable no-console */ console.log(prettyLine) /* eslint-enable no-console */}
}

type ArkalisError = Error & { arkalis: Arkalis, logLines: string[] }

type Flatten<T> = T extends Record<string, any> ? { [k in keyof T] : T[k] } : never
type UnionToIntersection<U> = (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

export type ArkalisCore = {
  client: CDP.Client,
  log: (...args: any[]) => void,
  warn: (...args: any[]) => never[],
  wait: (ms: number) => Promise<unknown>,
  pause: () => Promise<unknown>,
  scraperMeta: Required<ScraperMetadata>,
  debugOptions: Required<DebugOptions>,
}

type ArkalisPluginBuiltins = {
  close?: () => Promise<void> | void
}
export type ArkalisPlugin = (arkalis: ArkalisCore) => Record<string, any> & ArkalisPluginBuiltins
type ArkalisPluginExportsAll = Omit<Flatten<UnionToIntersection<Awaited<ReturnType<typeof DEFAULT_PLUGINS[keyof typeof DEFAULT_PLUGINS]>>>>, keyof ArkalisPluginBuiltins>
type ArkalisPluginExports = Awaited<ReturnType<typeof DEFAULT_PLUGINS[keyof typeof DEFAULT_PLUGINS]>> & ArkalisPluginBuiltins
export type Arkalis = Flatten<ArkalisCore & ArkalisPluginExportsAll>
export type ArkalisResponse<T> = { result: T | undefined, logLines: string[] }

const DEFAULT_PLUGINS = {
  arkalisResponseCache,    // add ability to cache results
  arkalisProxy,            // pick a proxy server (if one is required)
  arkalisBrowser,          // launch chrome (w/ blocking, window, timezone, proxy)
  arkalisInteraction,      // human-y mouse and keyboard control
  arkalisRequests,         // subscribe to request events and see stats like bytes used and cache hits
  arkalisInterceptor,      // adds ability to intercept requests, plus adds http auth proxy support
  arkalisPageHelpers,      // page helpers
  // arkalisHar,              // EXPERIMENTAL: adds ability to generate HAR files
} as const

async function runArkalisAttempt<T>(code: (arkalis: Arkalis) => Promise<T>, debugOpts: DebugOptions, scraperMetadata: ScraperMetadata, cacheKey: string): Promise<ArkalisResponse<T>> {
  const debugOptions = { ...defaultDebugOptions, ...debugOpts }
  const scraperMeta = { ...defaultScraperMetadata, ...scraperMetadata }
  const logLines: string[] = []

  const identifier = `${Math.random().toString(36).substring(2, 6)}-${cacheKey}`
  const startTime = Date.now()
  log(`Starting Arkalis run for scraper ${scraperMeta.name}`)

  const loadedPlugins: ArkalisPluginExports[] = []
  const arkalisCore: ArkalisCore = { client: undefined! as CDP.Client, log, warn, wait, scraperMeta, debugOptions, pause }

  // Loading plugins one at a time, populating the Arkalis object with their exports. Note that though we cast this
  // object as ArkalisCore, it can be recasted to Arkalis in the plugin, allowing access to previous plugins' exports.
  let arkalis = { ...arkalisCore } as Arkalis
  for (const pluginName of Object.keys(DEFAULT_PLUGINS)) {
    try {
      const loadedPlugin = await DEFAULT_PLUGINS[pluginName as keyof typeof DEFAULT_PLUGINS](arkalis as ArkalisCore)
      loadedPlugins.push(loadedPlugin)
      arkalis = { ...arkalis, ...loadedPlugin }
    } catch (err) {
      arkalis.log(`Error loading plugin ${pluginName}: ${(err as Error).message}\n${(err as Error).stack!}`)
      await close()
      return { result: undefined, logLines }
    }
  }

  ////////////////////////////////////

  async function close() {
    for (const plugin of loadedPlugins.slice().reverse())
      plugin.close && await plugin.close()
  }

  function log(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    logLines.push(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${prettyLine}`)
    debugOptions.liveLog?.(prettyLine, identifier)
  }

  function warn(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    log(c.yellowBright("WARN"), c.yellowBright(prettyLine))
    return []
  }

  async function wait(ms: number) {
    // eslint-disable-next-line no-restricted-globals
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async function pause() {
    log(c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8282/vnc.html) ***")))
    return wait(10000000)
  }

  function logAttemptResult(failed: boolean) {
    debugOptions.winston?.log(failed ? "error" : "info", logLines.join("\n"), {
      labels: {
        type: "scraper-run",
        scraper_name: scraperMeta.name,
        start_unix: startTime,
        id: identifier,
        duration_ms: Date.now() - startTime,
        status: failed ? "failure" : "success",
      },
      noConsole: true,
    })
  }

  function prettifyArgs(args: any[]) {
    if (typeof args === "string")
      return args
    return args.map((item: any) => typeof item === "string"
      ? item
      : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
  }

  async function run() {
    const result = await arkalis.runAndCache<T>(`result-${cacheKey}`, async () => code(arkalis))
    return { result, logLines }
  }

  ///////////////

  let success = false
  return run().then((result) => { success = true; return result }).catch(async (error) => {
    const fullError = prettifyArgs([c.red("Ending scraper attempt due to:"), error])
    const timestampedError = fullError.split("\n").map(errLine => `[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${errLine}`).join("\n")
    log(timestampedError)

    if (debugOptions.pauseAfterError)
      await pause()

    Object.assign(error, { logLines, arkalis })
    throw error

  }).finally(async () => {
    if (success && debugOptions.pauseAfterRun)
       await pause()

    const successText = success ? c.greenBright("SUCCESSFULLY") : c.redBright("UNSUCCESSFULLY")
    log(`Completed attempt ${successText} in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${arkalis.stats().summary})`)
    logAttemptResult(!success)
    await close()
  })
}

export async function runArkalis<T>(code: (arkalis: Arkalis) => Promise<T>, debugOpts: DebugOptions, scraperMetadata: ScraperMetadata, cacheKey: string): Promise<ArkalisResponse<T>> {
  const allLogLines: string[] = []

  return pRetry(async() => {
    const attemptResult = await runArkalisAttempt(code, debugOpts, scraperMetadata, cacheKey)
    allLogLines.push(...attemptResult.logLines)
    return { result: attemptResult.result, logLines: allLogLines }

  }, { minTimeout: 0, maxTimeout: 0, retries: (debugOpts.maxAttempts ?? defaultDebugOptions.maxAttempts) - 1, onFailedAttempt: (error) => {
    const arkalisError = error as typeof error & ArkalisError
    arkalisError.arkalis.warn(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]!}`)
    allLogLines.push(...arkalisError.logLines)

  } }).catch(e => {
    return { result: undefined, logLines: allLogLines }
  })
}
