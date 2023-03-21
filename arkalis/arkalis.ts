import tmp from "tmp-promise"
import { ChildProcess, exec } from "node:child_process"
import CDP from "chrome-remote-interface"
import type { Protocol } from "devtools-protocol" // "chrome-remote-interface" // "chrome-remote-interface/node_modules/devtools-protocol"
import pRetry from "p-retry"
import globToRegexp from "glob-to-regexp"
import c from "ansi-colors"
import url from "node:url"
import { promises as fs } from "node:fs"
import os from "node:os"
import net from "node:net"
import { Mouse } from "./mouse.js"
import * as dotenv from "dotenv"
import dayjs from "dayjs"
import util from "util"
import winston from "winston"
import ArkalisDb from "./db.js"

export type WaitForType = { type: "url", url: string | RegExp, statusCode?: number } | { type: "html", html: string | RegExp }
export type WaitForReturn = { name: string, response?: any }
type Request = { requestId: string, request?: Protocol.Network.Request, response?: Protocol.Network.Response, downloadedBytes: number, startTime?: number, endTime?: number, success?: boolean }

export type InterceptAction = {
  action: "fulfill" | "continue" | "fail"
  dataObj?: object
} & (
  (Protocol.Fetch.FulfillRequestRequest | Protocol.Fetch.ContinueRequestRequest | Protocol.Fetch.FailRequestRequest) | Omit<Protocol.Fetch.FulfillRequestRequest, "requestId">
)

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

  /** Browser resources will be cached globally (i.e. across all running instances) if this is true. Set to false to
   * not store.
   * @default true */
  useGlobalBrowserCache?: boolean

  /** Amount of seconds to cache the results for (TTL). Set to 0 to not cache. Set to null to use the configured
   * default (defaultResultCacheTtl).
   * @default undefined */
  resultCacheTtl?: number | null
}
export const defaultScraperMetadata: Required<ScraperMetadata> = {
  name: "default", defaultTimeout: 15000, blockUrls: [], useGlobalBrowserCache: true, resultCacheTtl: null
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

  /** Timezone in America/Los_Angeles format. If not set, will use the system timezone.
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

  /** Optionally use a database for things like caching results. If not set, won't use a database.
   * @default null */
  globalDb?: ArkalisDb | null

  /** Set to enable result cache
   * @default false */
  useResultCache?: boolean

  /** Set the default TTL (in seconds) for the result cache. Set to 0 to not cache by default.
   * @default 0 */
  defaultResultCacheTtl?: number
}
export const defaultDebugOptions: Required<DebugOptions> = {
  maxAttempts: 3, pauseAfterError: false, pauseAfterRun: false, useProxy: true, browserDebug: false, winston: null,
  globalBrowserCacheDir: "./tmp/browser-cache", globalDb: null, drawMousePath: false,
  timezone: null, showRequests: true, useResultCache: false, defaultResultCacheTtl: 0,
  log: (prettyLine: string) => { /* eslint-disable no-console */ console.log(prettyLine) /* eslint-enable no-console */}
}

export class Arkalis {
  private browserInstance?: ChildProcess
  private requests: Record<string, Request> = {}
  private mouse!: Mouse
  private db?: ArkalisDb

  private static proxies: Record<string, string[]> = {}
  private proxy: string | undefined = undefined
  private debugOptions: Required<DebugOptions>
  private scraperMeta: Required<ScraperMetadata>

  public client!: CDP.Client
  public defaultTimeoutMs = 30_000

  private logLines: string[] = []
  private identifier: string = ""
  private attemptStartTime: number = Date.now()

  private intercepts: { pattern: RegExp, type: "Request" | "Response", callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction }[] = []
  private onExitHandler: any
  private tmpDir?: tmp.DirectoryResult

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

  private constructor(debugOptions: DebugOptions, scraperMeta: ScraperMetadata) {
    this.debugOptions = { ...defaultDebugOptions, ...debugOptions }
    this.scraperMeta = { ...defaultScraperMetadata, ...scraperMeta }
    this.db = this.debugOptions.globalDb ?? undefined
  }

  private async launchBrowser() {
    // tmp dir for the browser profile (without browser cache since we remap that outside the profile)
    this.tmpDir = await tmp.dir({ unsafeCleanup: true })

    // find port for CDP
    const freePort = await new Promise<number>(resolve => {
      const srv = net.createServer()
      srv.listen(0, () => {
        const port = (srv.address() as net.AddressInfo).port
        srv.close((err) => resolve(port))
      })
    })

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

    const switches = [
      // these should all be undetectable, but speed things up
      "disable-sync", "disable-backgrounding-occluded-windows", "disable-breakpad",
      "disable-domain-reliability", "disable-background-networking", "disable-features=AutofillServerCommunication",
      "disable-features=CertificateTransparencyComponentUpdater", "enable-crash-reporter-for-testing", "no-service-autorun",
      "no-first-run", "no-default-browser-check", "disable-prompt-on-repost", "disable-client-side-phishing-detection",
      "disable-features=InterestFeedContentSuggestions", "disable-features=Translate", "disable-hang-monitor",
      "autoplay-policy=no-user-gesture-required", "use-mock-keychain", "disable-omnibox-autocomplete-off-method",
      "disable-gaia-services", "disable-crash-reporter", "homepage 'about:blank'",
      "disable-features=MediaRouter", "metrics-recording-only", "disable-features=OptimizationHints",
      "disable-component-update", "disable-features=CalculateNativeWinOcclusion", "enable-precise-memory-info",
      "noerrdialogs", "disable-component-update",

      "no-sandbox", "disable-dev-shm-usage",  // for linux docker

      // "disable-blink-features=AutomationControlled", // not working
      // "auto-open-devtools-for-tabs",

      this.debugOptions.browserDebug === "verbose" ? "enable-logging=stderr --v=2": "",
      this.scraperMeta.useGlobalBrowserCache ? `disk-cache-dir="${this.debugOptions.globalBrowserCacheDir}"` : "",
      `user-data-dir="${this.tmpDir.path}"`,
      windowPos ? `window-position=${windowPos[0]},${windowPos[1]}` : "",
      `window-size=${windowSize[0]},${windowSize[1]}`,
      `remote-debugging-port=${freePort}`
    ]

    // proxy
    if (this.debugOptions.useProxy) {
      const proxies = Arkalis.proxies[this.scraperMeta.name] ?? Arkalis.proxies["default"]
      if ((proxies ?? []).length > 0) {
        this.proxy = proxies![Math.floor(Math.random() * proxies!.length)]!

        // if the format is `http://user:pass_country-UnitedStates_session-AAABBBCC@proxy.abcdef.io:31112`, roll the
        // proxy session id to get a new ip address
        const dynamicProxy = /http.*:\/\/.+:(?<start>\S{16}_country-\S+_session-)(?<sess>\S{8})@/u.exec(this.proxy)
        if (dynamicProxy)
          this.proxy = this.proxy.replace(dynamicProxy.groups!["sess"]!, Math.random().toString(36).slice(2).substring(0, 8))

        switches.push(`proxy-server='${url.parse(this.proxy).protocol}//${url.parse(this.proxy).host}'`)
        switches.push(`host-resolver-rules='MAP * ~NOTFOUND , EXCLUDE ${url.parse(this.proxy).hostname}'`)

        this.log(c.magentaBright(`Using proxy server: ${url.parse(this.proxy).host}`))
      } else {
        this.log(c.yellowBright("Not using proxy server!"))
      }
    }

    // detect chrome binary
    const defaultPath =
      os.type() === "Darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" :
      os.type() === "Linux" ? "/usr/bin/chromium-browser" : ""
    const binPath = process.env["CHROME_PATH"] ?? defaultPath
    if (!await fs.access(binPath).then(() => true).catch(() => false))
      throw new Error(`Chrome binary not found at "${binPath}". Please set the CHROME_PATH environment variable to the location of the Chrome binary`)
    const cmd = `"${binPath}" ${switches.map(s => s.length > 0 ? `--${s}` : "").join(" ")}`

    // launch browser
    this.debugOptions.browserDebug && this.log(`Launching browser: ${cmd}`)
    this.browserInstance = exec(cmd)
    this.browserInstance.stdout!.on("data", (data) => this.debugOptions.browserDebug && this.log(data.toString().trim()))
    this.browserInstance.stderr!.on("data", (data) => this.debugOptions.browserDebug && this.log(data.toString().trim()))
    this.onExitHandler = () => this.browserInstance?.kill("SIGKILL")
    process.on("exit", this.onExitHandler)

    // connect to cdp client
    this.debugOptions.browserDebug && this.log("connecting to cdp client")
    this.client = await pRetry(async () => CDP({ port: freePort }), { forever: true, maxTimeout: 1000, maxRetryTime: this.defaultTimeoutMs })
    await this.client.Network.enable()
    await this.client.Page.enable()
    await this.client.Runtime.enable()
    await this.client.DOM.enable()

    await this.client.Fetch.enable({ handleAuthRequests: true, patterns:
      [{ urlPattern: "*", requestStage: "Request" }, { urlPattern: "*", requestStage: "Response" }] })
    this.client.Fetch.requestPaused(this.onRequestPaused.bind(this))
    this.client.Fetch.authRequired(this.onAuthRequired.bind(this))

    // timezone
    if (this.debugOptions.timezone)
      await this.client.Emulation.setTimezoneOverride({ timezoneId: this.debugOptions.timezone })

    // human-y mouse and keyboard control
    this.mouse = new Mouse(this.client, windowSize, this.debugOptions.drawMousePath!)

    // used for stats and request logging
    this.client.Network.requestWillBeSent((request) => {
      if (!this.requests[request.requestId])
        this.requests[request.requestId] = { requestId: request.requestId, downloadedBytes: 0 }
      this.requests[request.requestId] = { ...this.requests[request.requestId]!, request: request.request, startTime: request.timestamp }
    })
    this.client.Network.responseReceived((response) => {    // headers only
      if (!this.requests[response.requestId])
        this.requests[response.requestId] = { requestId: response.requestId, downloadedBytes: 0 }
      this.requests[response.requestId]!.response = response.response
      if (!response.response.fromDiskCache)
        this.requests[response.requestId]!.downloadedBytes = parseInt(response.response.headers["content-length"] ?? "0")
    })
    this.client.Network.loadingFinished((response) => {
      if (!this.requests[response.requestId])
        this.requests[response.requestId] = { requestId: response.requestId, downloadedBytes: 0 }
      this.requests[response.requestId]!.endTime = response.timestamp
      this.requests[response.requestId]!.success = true
      this.completedLoading(response.requestId)
    })
    this.client.Network.loadingFailed((response) => {
      if (!this.requests[response.requestId])
        this.requests[response.requestId] = { requestId: response.requestId, downloadedBytes: 0 }
      this.requests[response.requestId]!.endTime = response.timestamp
      this.requests[response.requestId]!.success = false
      this.completedLoading(response.requestId)
    })

    // timeouts
    this.scraperMeta.defaultTimeout && (this.defaultTimeoutMs = this.scraperMeta.defaultTimeout)

    // block requested URLs
    if (this.scraperMeta.blockUrls.length > 0)
      await this.client.Network.setBlockedURLs({ urls: this.scraperMeta.blockUrls })
  }

  // Called whenever a request/response is processed
  private onRequestPaused = (req: Protocol.Fetch.RequestPausedEvent) => {
    for (const intercept of this.intercepts.filter(i => (req.responseStatusCode && i.type === "Response")
        || (!req.responseStatusCode && i.type === "Request"))) {
      if (intercept.pattern.test(req.request.url)) {
        const action = intercept.callback(req)
        if (action.action === "continue") {
          if (req.responseStatusCode) {
            return this.client.Fetch.continueResponse({ ...action, requestId: req.requestId } as Protocol.Fetch.ContinueResponseRequest)
          } else {
            if (action.dataObj)
              return this.client.Fetch.continueRequest({ ...action, requestId: req.requestId, postData: Buffer.from(JSON.stringify(action.dataObj)).toString("base64") } as Protocol.Fetch.ContinueRequestRequest)
            else
              return this.client.Fetch.continueRequest({ ...action, requestId: req.requestId } as Protocol.Fetch.ContinueRequestRequest)
          }

        } else if (action.action === "fulfill") {
          if (action.dataObj)
            return this.client.Fetch.fulfillRequest({ ...action, requestId: req.requestId, body: Buffer.from(JSON.stringify(action.dataObj)).toString("base64") } as Protocol.Fetch.FulfillRequestRequest)
          else
            return this.client.Fetch.fulfillRequest({ ...action, requestId: req.requestId } as Protocol.Fetch.FulfillRequestRequest)

        } else {
          return this.client.Fetch.failRequest({ ...action, requestId: req.requestId } as Protocol.Fetch.FailRequestRequest)
        }
      }
    }

    // No intercepts matched, continue as normal
    if (req.responseStatusCode)
      return this.client.Fetch.continueResponse({ requestId: req.requestId }).catch(() => {})
    else
      return this.client.Fetch.continueRequest({ requestId: req.requestId }).catch(() => {})
  }

  // Called when HTTP proxy auth is required
  private onAuthRequired = (authReq: Protocol.Fetch.AuthRequiredEvent) => {
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

  private prettifyArgs = (args: any[]) => {
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

  private completedLoading(requestId: string) {
    const item = this.requests[requestId]!
    if (!this.requests[requestId]?.request?.method)
      return

    const urlToShow = item.request!.url.startsWith("data:") ? `${item.request!.url.slice(0, 80)}...` : item.request!.url
    const line =
      `${item.response?.status ? c.green(item.response.status.toString()) : c.red("BLK")} ` +
      `${item.response?.fromDiskCache ? c.yellowBright("CACHE") : (Math.ceil(item.downloadedBytes / 1024).toString() + "kB").padStart(5, " ")} ` +
      `${item.request?.method.padEnd(4, " ").slice(0, 4)} ` +
      `${c.white(urlToShow)} ` +
      `${c.yellowBright(item.response?.headers["cache-control"] ?? "")}`

    this.debugOptions.showRequests && this.log(line)
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
    const arkalis = new Arkalis(debugOptions, meta)

    arkalis.identifier = `${Math.random().toString(36).substring(2, 6)}-${cacheKey}`
    let attemptError = false
    let attemptResult: ReturnType | undefined = undefined

    const resultCacheTtl = arkalis.scraperMeta.resultCacheTtl ?? arkalis.debugOptions.defaultResultCacheTtl
    if (arkalis.db && arkalis.debugOptions.useResultCache && resultCacheTtl > 0) {
      const existingCache = await arkalis.db.get(`result-${cacheKey}`)
      if (existingCache) {
        arkalis.log(`Found cached result for ${cacheKey}`)
        attemptResult = JSON.parse(existingCache)
      }
    }

    attemptResult ||= await pRetry(async() => {
      await arkalis.launchBrowser()

      const result = await code(arkalis)
      if (arkalis.debugOptions.pauseAfterRun)
        await arkalis.pause()

      // Store the successful result
      if (arkalis.db && arkalis.debugOptions.useResultCache && resultCacheTtl > 0)
        await arkalis.db.set(`result-${cacheKey}`, JSON.stringify(result), resultCacheTtl)

      attemptError = false
      return result

    }, { retries: arkalis.debugOptions.maxAttempts! - 1, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {
      attemptError = true
      const fullError = arkalis.prettifyArgs([c.red("Ending scraper due to error"), error])
      const timestampedError = fullError.split("\n").map(errLine => `[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${errLine}`).join("\n")
      arkalis.logLines.push(timestampedError)

      if (arkalis.debugOptions.pauseAfterError) {
        arkalis.log(error)
        await arkalis.pause()
      }
      arkalis.log(c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))
      await arkalis.close()

    }}).catch(async e => {    // failed all retries
      arkalis.log(c.red(`All retry attempts exhausted: ${e.message}`))
      return undefined

    }).finally(async () => {
      arkalis.logAttemptResult(attemptError)
      await arkalis.close().catch(() => {})

      arkalis.log(`completed ${attemptError ? c.red("in failure ") : ""}in ${(Date.now() - arkalis.attemptStartTime).toLocaleString("en-US")}ms (${arkalis.stats().summary})`)
    })

    return { result: attemptResult, logLines: arkalis.logLines }
  }

  public async close() {
    this.debugOptions.browserDebug && this.log("closing cdp client and browser")
    this.intercepts = []

    process.removeListener("exit", this.onExitHandler)

    await this.client.Network.disable().catch(() => {})
    await this.client.Page.disable().catch(() => {})
    await this.client.Runtime.disable().catch(() => {})
    await this.client.DOM.disable().catch(() => {})
    await this.client.Fetch.disable().catch(() => {})

    await this.client.Browser.close().catch(() => {})
    await this.client.close().catch(() => {})

    this.onExitHandler()
    await this.tmpDir?.cleanup().catch(() => {})
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
    const subscriptions: Function[] = []
    const pollingTimers: NodeJS.Timer[] = []
    let timeout: NodeJS.Timeout | undefined

    try {
      const promises = Object.entries(items).map(([name, params]) => {
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
        }
      })
      promises.push(new Promise((resolve) => {
        // eslint-disable-next-line no-restricted-globals
        timeout = setTimeout(() => resolve({name: "timeout"}), this.defaultTimeoutMs)
      }))

      const result = await Promise.race(promises) as {name: string, response: any}
      if (result.name === "timeout")
        throw new Error("Timeout waiting for items")

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

  public stats() {
    const totRequests = Object.values(this.requests).length
    const cacheHits = Object.values(this.requests).filter((request) => request.response?.fromDiskCache).length
    const cacheMisses = totRequests - cacheHits
    const bytes = Object.values(this.requests).reduce((bytes, request) => (bytes += request.downloadedBytes), 0)

    const summary = `${totRequests.toLocaleString()} reqs, ${cacheHits.toLocaleString()} hits, ${cacheMisses.toLocaleString()} misses, ${bytes.toLocaleString()} bytes`
    return { totRequests, cacheHits, cacheMisses, bytes, summary }
  }

  public async clickSelector(selector: string) {
    return this.mouse.clickSelector(selector)
  }

  public async interceptRequest(urlPattern: string, callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    this.intercepts.push({ pattern: globToRegexp(urlPattern, { extended: true }), type: "Request", callback })
  }

  public async interceptResponse(urlPattern: string, callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    this.intercepts.push({ pattern: globToRegexp(urlPattern, { extended: true }), type: "Response", callback })
  }

  public log(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    this.logLines.push(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${prettyLine}`)
    this.debugOptions.log!(prettyLine, this.identifier)
  }

  public async pause() {
    this.log(c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8282/vnc.html) ***")))
    // eslint-disable-next-line no-restricted-globals
    await new Promise((resolve) => setTimeout(resolve, 10000000))
  }
}
