import { exec } from "node:child_process"
import CDP from "chrome-remote-interface"
import type { Protocol } from "devtools-protocol" // "chrome-remote-interface" // "chrome-remote-interface/node_modules/devtools-protocol"
import globToRegexp from "glob-to-regexp"
import c from "ansi-colors"
import url from "node:url"
import { Mouse } from "./mouse.js"
import * as dotenv from "dotenv"
import dayjs from "dayjs"
import util from "util"
import winston from "winston"
import FileSystemCache from "./fs-cache.js"
import { Stats } from "./stats.js"
import { Intercept, InterceptAction } from "./intercept.js"
import ChromeLauncher from "chrome-launcher"
import pRetry from "p-retry"

export type WaitForType = { type: "url", url: string | RegExp, statusCode?: number } | { type: "html", html: string | RegExp } | { type: "selector", selector: string }
export type WaitForReturn = { name: string, response?: any }

export type ScraperMetadata = {
  /** Unique name for the scraper */
  name: string,

  /** Blocks urls. Can contain *s to match.
   * @example ["google-analytics.com"]
   * @default [] */
  blockUrls?: string[]

  /** Set the default timeout for navigation and selector requests.
   * @default 30000 */
  defaultTimeout?: number

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
  name: "default", defaultTimeout: 30000, blockUrls: [], useGlobalBrowserCache: true, resultCacheTtlMs: null
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

  /** Custom logger. If not set, will use the general console logger.
   * @default console.log */
  log?: (prettyLine: string, id: string) => void

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
  log: (prettyLine: string) => { /* eslint-disable no-console */ console.log(prettyLine) /* eslint-enable no-console */}
}

export class Arkalis {
  public readonly debugOptions: Required<DebugOptions>
  public readonly scraperMeta: Required<ScraperMetadata>

  private mouse!: Mouse
  private stats!: Stats
  private intercept!: Intercept

  private browserInstance?: ChromeLauncher.LaunchedChrome
  private readonly cache?: FileSystemCache

  private readonly proxies: Record<string, string[]>
  private proxy: string | undefined = undefined

  public client!: CDP.Client
  public defaultTimeoutMs = defaultScraperMetadata.defaultTimeout

  private readonly logLines: string[] = []
  private identifier = ""
  private readonly attemptStartTime: number = Date.now()

  private constructor(debugOptions: DebugOptions, scraperMeta: ScraperMetadata) {
    this.debugOptions = { ...defaultDebugOptions, ...debugOptions }
    this.scraperMeta = { ...defaultScraperMetadata, ...scraperMeta }
    if (this.debugOptions.globalCachePath)
      this.cache = new FileSystemCache(this.debugOptions.globalCachePath)

    dotenv.config()
    this.proxies = Object.keys(process.env).reduce<Record<string, string[]>>((acc, k) => {
      if (!k.startsWith("PROXY_ADDRESS_"))
        return acc
      const groupName = k.replace("PROXY_ADDRESS_", "").toLowerCase()
      acc[groupName] = (process.env[k] ?? "").split(",")
      return acc
    }, {})
  }

  private async launchBrowser() {
    // pick a random window size
    const screenResolution = await new Promise<number[] | undefined>(resolve => {   // will return array of [width, height]
      exec("xdpyinfo | grep dimensions", (err, stdout) =>
        resolve(/ (?<res>\d+x\d+) /u.exec(stdout)?.[0].trim().split("x").map(num => parseInt(num)) ?? undefined))
    })
    let windowSize = [1920, 1080]
    let windowPos: number[] | undefined = undefined
    if (screenResolution) {
      windowSize = [Math.ceil(screenResolution[0]! * (Math.random() * 0.2 + 0.8)), Math.ceil(screenResolution[1]! * (Math.random() * 0.2 + 0.8))]
      windowPos = [Math.ceil((screenResolution[0]! - windowSize[0]!) * Math.random()), Math.ceil((screenResolution[1]! - windowSize[1]!) * Math.random())]
    }

    // these domains are used by the browser when creating a new profile
    const blockDomains = [
      "accounts.google.com", "clients2.google.com", "optimizationguide-pa.googleapis.com",
      "content-autofill.googleapis.com"
    ]

    const switches = [
      // these should all be undetectable, but speed things up
      "disable-sync", "disable-backgrounding-occluded-windows", "disable-breakpad",
      "disable-domain-reliability", "disable-background-networking", "disable-features=AutofillServerCommunication",
      "disable-features=CertificateTransparencyComponentUpdater", "enable-crash-reporter-for-testing", "no-service-autorun",
      "no-first-run", "no-default-browser-check", "disable-prompt-on-repost", "disable-client-side-phishing-detection",
      "disable-features=InterestFeedContentSuggestions", "disable-features=Translate", "disable-hang-monitor",
      "autoplay-policy=no-user-gesture-required", "use-mock-keychain", "disable-omnibox-autocomplete-off-method",
      "disable-gaia-services", "disable-crash-reporter", "noerrdialogs", "disable-component-update",
      "disable-features=MediaRouter", "metrics-recording-only", "disable-features=OptimizationHints",
      "disable-component-update", "disable-features=CalculateNativeWinOcclusion", "enable-precise-memory-info",

      "no-sandbox", "disable-dev-shm-usage",  // for linux docker

      // "disable-blink-features=AutomationControlled", // not working
      // "auto-open-devtools-for-tabs",
      // "log-net-log=tmp/out.json", "net-log-capture-mode=Everything",     // note, does not log requests

      `host-rules=${blockDomains.map(blockDomain => `MAP ${blockDomain} 0.0.0.0`).join(", ")}`,   // NOTE: detectable!
      this.debugOptions.browserDebug === "verbose" ? "enable-logging=stderr": "",
      this.debugOptions.browserDebug === "verbose" ? "v=2" : "",
      this.scraperMeta.useGlobalBrowserCache ? `disk-cache-dir="${this.debugOptions.globalBrowserCacheDir}"` : "",
      windowPos ? `window-position=${windowPos[0]},${windowPos[1]}` : "",
      `window-size=${windowSize[0]},${windowSize[1]}`,
    ]

    // proxy
    if (this.debugOptions.useProxy) {
      const proxies = this.proxies[this.scraperMeta.name] ?? this.proxies["default"]
      if ((proxies ?? []).length > 0) {
        this.proxy = proxies![Math.floor(Math.random() * proxies!.length)]!

        // if the format is `http://user:pass_country-UnitedStates_session-AAABBBCC@proxy.abcdef.io:31112`, roll the
        // proxy session id to get a new ip address
        const dynamicProxy = /http.*:\/\/.+:(?<start>\S{16}_country-\S+_session-)(?<sess>\S{8})@/u.exec(this.proxy)
        if (dynamicProxy)
          this.proxy = this.proxy.replace(dynamicProxy.groups!["sess"]!, Math.random().toString(36).slice(2).substring(0, 8))

        switches.push(`proxy-server=${url.parse(this.proxy).protocol}//${url.parse(this.proxy).host}`)
        switches.push(`host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE ${url.parse(this.proxy).hostname}`)

        this.debugOptions.timezone ??= process.env[`PROXY_TZ_${this.scraperMeta.name.toUpperCase()}`] ?? process.env["PROXY_TZ_DEFAULT"] ?? null

        this.log(c.magentaBright(`Using proxy server: ${url.parse(this.proxy).host} ${this.debugOptions.timezone ? `(${this.debugOptions.timezone})` : ""}`))
      } else {
        this.warn("Not using proxy server!")
      }
    }

    this.browserInstance = await ChromeLauncher.launch({
      chromeFlags: switches.map(s => s.length > 0 ? `--${s}` : ""),
      ignoreDefaultFlags: true,
      logLevel: this.debugOptions.browserDebug ? "verbose" : "silent",
    })

    // connect to cdp client
    this.debugOptions.browserDebug && this.log("connecting to cdp client")
    this.client = await CDP({ port: this.browserInstance!.port })
    await this.client.Network.enable()
    await this.client.Page.enable()
    await this.client.Runtime.enable()
    await this.client.DOM.enable()

    this.intercept = new Intercept(this.client, this.onAuthRequired.bind(this))
    await this.intercept.enable()

    // timezone (set either by the caller or the proxy)
    if (this.debugOptions.timezone)
      await this.client.Emulation.setTimezoneOverride({ timezoneId: this.debugOptions.timezone })

    // human-y mouse and keyboard control
    this.mouse = new Mouse(this.client, windowSize, this.debugOptions.drawMousePath!)

    // used for stats and request logging
    this.stats = new Stats(this.client, this.debugOptions.showRequests, this.log.bind(this))

    // timeouts
    this.scraperMeta.defaultTimeout && (this.defaultTimeoutMs = this.scraperMeta.defaultTimeout)

    // block requested URLs
    if (this.scraperMeta.blockUrls.length > 0)
      await this.client.Network.setBlockedURLs({ urls: this.scraperMeta.blockUrls })
  }

  // Called when HTTP proxy auth is required
  private onAuthRequired(authReq: Protocol.Fetch.AuthRequiredEvent) {
    if (authReq.authChallenge.source !== "Proxy")
      return
    if (!this.proxy)
      return
    const auth = url.parse(this.proxy).auth

    void this.client.Fetch.continueWithAuth({
      requestId: authReq.requestId,
      authChallengeResponse: {
        response: "ProvideCredentials",
        username: auth!.split(":")[0],
        password: auth!.split(":")[1]
      }
    })
  }

  private static prettifyArgs(args: any[]) {
    if (typeof args === "string")
      return args
    return args.map((item: any) => typeof item === "string"
      ? item
      : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
  }

  private logAttemptResult(failed: boolean) {
    this.debugOptions.winston?.log(failed ? "error" : "info", this.logLines.join("\n"), {
      labels: {
        type: "scraper-run",
        scraper_name: this.scraperMeta.name,
        start_unix: this.attemptStartTime,
        id: this.identifier,
        duration_ms: Date.now() - this.attemptStartTime,
        status: failed ? "failure" : "success",
      },
      noConsole: true,
    })
  }

  private async throwIfBadResponse(statusCode: number, bodyText: string) {
    if (statusCode !== 200) {
      if (bodyText.includes("<H1>Access Denied</H1>"))
        throw new Error(`Access Denied anti-botting while loading page (status: ${statusCode})`)
      if (bodyText.includes("div class=\"px-captcha-error-header\""))
        throw new Error("Perimeter-X captcha anti-botting while loading page")
      this.log(bodyText)

      throw new Error(`Page loading failed with status ${statusCode}`)
    }
  }

  ///////////////////////////
  // PUBLIC API
  ///////////////////////////

  public static async run<ReturnType>(code: (arkalis: Arkalis) => Promise<ReturnType>, debugOptions: DebugOptions, meta: ScraperMetadata, cacheKey: string) {
    const startTime = Date.now()
    let arkalis: Arkalis | undefined
    const logLines: string[] = []

    return pRetry(async() => {
      arkalis = new Arkalis(debugOptions, meta)
      arkalis.identifier = `${Math.random().toString(36).substring(2, 6)}-${cacheKey}`    // unique id per attempt

      // Use a previously cached response if available
      const resultCacheTtlMs = arkalis.scraperMeta.resultCacheTtlMs ?? arkalis.debugOptions.defaultResultCacheTtl
      if (arkalis.cache && arkalis.debugOptions.useResultCache && resultCacheTtlMs > 0) {
        const existingCache = await arkalis.cache.get(`result-${cacheKey}`)
        if (existingCache) {
          arkalis.log(`Found and using cached result for ${cacheKey}`)
          return { result: existingCache as ReturnType, logLines: arkalis.logLines }
        }
      }

      await arkalis.launchBrowser()
      const result = await code(arkalis)
      arkalis.debugOptions.pauseAfterRun && await arkalis.pause()

      // Store the successful result into cache
      if (arkalis.cache && arkalis.debugOptions.useResultCache && resultCacheTtlMs > 0)
        await arkalis.cache.set(`result-${cacheKey}`, result, resultCacheTtlMs)

      // Log this successful attempt
      logLines.push(...arkalis.logLines)
      arkalis.logAttemptResult(false)
      arkalis.log(`completed in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${arkalis.stats.toString().summary})`)
      await arkalis.close()
      arkalis = undefined

      return { result, logLines }

    }, { retries: (debugOptions.maxAttempts ?? defaultDebugOptions.maxAttempts) - 1, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {
      const fullError = Arkalis.prettifyArgs([c.red("Ending scraper due to error"), error])
      const timestampedError = fullError.split("\n").map(errLine => `[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${errLine}`).join("\n")
      arkalis!.logLines.push(timestampedError)

      if (arkalis!.debugOptions.pauseAfterError) {
        arkalis!.log(error)
        await arkalis!.pause()
      }
      arkalis!.log(c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))

      if (error.retriesLeft === 0)
        arkalis!.log(c.red(`All retry attempts exhausted: ${error.message}`))

      // Log this failed attempt
      logLines.push(...arkalis!.logLines)
      arkalis!.logAttemptResult(true)
      await arkalis!.close()
      arkalis = undefined

    }}).catch((e) => {    // failed all retries + failed in error handlers
      arkalis!.log(e)
      arkalis!.log(`completed ${c.red("in failure")} in ${(Date.now() - startTime).toLocaleString("en-US")}ms`)
      return { result: undefined, logLines }

    }).finally(async () => {
      await arkalis?.close()
      arkalis = undefined
    })
  }

  public async close() {
    this.debugOptions.browserDebug && this.log("closing cdp client and browser")
    await this.intercept.disable()

    await this.client.Network.disable().catch(() => {})
    await this.client.Page.disable().catch(() => {})
    await this.client.Runtime.disable().catch(() => {})
    await this.client.DOM.disable().catch(() => {})

    await this.client.Browser.close().catch(() => {})
    await this.client.close().catch(() => {})

    this.browserInstance?.kill()
  }

  /** Navigates to the specified URL and returns immediately
   * @param gotoUrl - the url to navigate to */
  public goto(gotoUrl: string) {
    this.log(`navigating to ${gotoUrl}`)
    void this.client.Page.navigate({ url: gotoUrl })
  }

  /** Waits for a url to be loaded or specific html to be present
   * @param items - a map of name to url/html to wait for. when waiting for a url, optionally passing a `statusCode`
   * will wait only trigger on that http status code, unless the expected code is 200 in which case the request will be
   * validated */
  public async waitFor(items: Record<string, WaitForType>): Promise<WaitForReturn> {
    const subscriptions: (() => void)[] = []
    const pollingTimers: NodeJS.Timer[] = []
    let timeout: NodeJS.Timeout | undefined

    try {
      const promises = Object.entries(items).map(async ([name, params]) => {
        switch (params.type) {
          case "url":
            return new Promise<{name: string, response: object}>((resolve, reject) => {
              let resultResponse = {} as any
              let lookingForRequestId: string | undefined = undefined
              const urlRegexp = typeof params.url === "string" ? globToRegexp(params.url, { extended: true }) : params.url

              // The request first comes in as headers only
              subscriptions.push(this.client.Network.responseReceived(async (response) => {
                if (urlRegexp.test(response.response.url) && response.type !== "Preflight" &&
                    (params.statusCode === undefined || params.statusCode === 200 || params.statusCode === response.response.status)) {
                  lookingForRequestId = response.requestId
                  resultResponse = response.response
                }
              }))

              // Then the body comes in via Network.dataReceived and finishes with Network.loadingFinished
              subscriptions.push(this.client.Network.loadingFinished(async (response) => {
                if (lookingForRequestId === response.requestId) {
                  const responseResult = await this.client.Network.getResponseBody({ requestId: lookingForRequestId })
                  if (params.statusCode === 200)    // do extra verifications if expecting a success
                    this.throwIfBadResponse(resultResponse.status, responseResult.body).catch((e) => reject(e))
                  resolve({name, response: {...resultResponse, body: responseResult.body}})
                }
              }))
            })

          case "html":
            return new Promise<{name: string}>((resolve, reject) => {
              const htmlRegexp = typeof params.html === "string" ? globToRegexp(params.html, { extended: true, flags: "ugm" }) : params.html
              // eslint-disable-next-line no-restricted-globals
              pollingTimers.push(setInterval(async () => {
                const evalResult = await this.client.Runtime.evaluate(
                  { expression: "document.documentElement.outerHTML", returnByValue: true }).catch((e) => { reject(e); return undefined })
                if (!evalResult) return

                const text = evalResult.result.value as string
                if (htmlRegexp.test(text))
                  resolve({name})
              }, 1000))
            })

          case "selector":
            return new Promise<{name: string}>((resolve, reject) => {
              // eslint-disable-next-line no-restricted-globals
              pollingTimers.push(setInterval(async () => {
                const doc = await this.client.DOM.getDocument({ depth: -1 })
                const node = await this.client.DOM.querySelector({ nodeId: doc.root.nodeId, selector: params.selector })
                if (node.nodeId)
                  resolve({name})
              }, 1000))
            })
        }
      })
      promises.push(new Promise((resolve) => {
        /* eslint-disable no-restricted-globals */
        // We use a timeout since the last response received (not since the timer started) as a way of detecting if
        // the socket is no longer functional
        const timeoutHandler = () => {
          if (Date.now() - this.stats.lastResponseTime >= this.defaultTimeoutMs) {
            resolve({name: "timeout"})
          } else {
            timeout = setTimeout(timeoutHandler.bind(this), this.defaultTimeoutMs - (Date.now() - this.stats.lastResponseTime))
          }
        }
        timeout = setTimeout(timeoutHandler.bind(this), this.defaultTimeoutMs)
        /* eslint-enable no-restricted-globals */
      }))

      const result = await Promise.race(promises) as {name: string, response: any}
      if (result.name === "timeout")
        throw new Error(`Timeout waiting for items (${this.defaultTimeoutMs} ms})`)

      return result

    } finally {
      subscriptions.forEach((unsub) => unsub())
      pollingTimers.forEach((timer) => clearInterval(timer))
      if (timeout) clearTimeout(timeout)
    }
  }

  public async getSelectorContent(selector: string) {
    const result = await this.client.Runtime.evaluate({ expression: `document.querySelector("${selector}")?.textContent`, returnByValue: true })
    return result.result.value as string | undefined
  }

  public async evaluate<ReturnType>(expression: string) {
    const result = await this.client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true })
    return result.result.value as ReturnType
  }

  public async clickSelector(selector: string) {
    return this.mouse.clickSelector(selector)
  }

  public async interceptRequest(urlPattern: string, callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    this.intercept.add(globToRegexp(urlPattern, { extended: true }), "Request", callback)
  }

  public async interceptResponse(urlPattern: string, callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    this.intercept.add(globToRegexp(urlPattern, { extended: true }), "Response", callback)
  }

  public log(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    this.logLines.push(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${prettyLine}`)
    this.debugOptions.log!(prettyLine, this.identifier)
  }

  public warn(...args: any[]) {
    this.log(c.yellowBright(`WARN: ${args}`))
    return []
  }

  public async pause() {
    this.log(c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8282/vnc.html) ***")))
    // eslint-disable-next-line no-restricted-globals
    await new Promise((resolve) => setTimeout(resolve, 10000000))
  }
}
