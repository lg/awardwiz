import { exec } from "node:child_process"
import CDP from "chrome-remote-interface"
import type { Protocol } from "devtools-protocol"
import globToRegexp from "glob-to-regexp"
import c from "ansi-colors"
import url from "node:url"
import { Mouse } from "./mouse.js"
import dayjs from "dayjs"
import util from "util"
import winston from "winston"
import FileSystemCache from "./fs-cache.js"
import { Stats } from "./stats.js"
import { Intercept, InterceptAction } from "./intercept.js"
import ChromeLauncher from "chrome-launcher"
import pRetry from "p-retry"

export type WaitForType = { type: "url", url: string | RegExp, statusCode?: number } | { type: "html", html: string | RegExp } | { type: "selector", selector: string }
export type WaitForReturn = { name: string, response?: Protocol.Network.Response & { body: string } }

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

export type Arkalis = Parameters<Parameters<(typeof runArkalisAttempt)>[0]>[0]
async function runArkalisAttempt<T, R extends typeof arkalisPublic>(code: (arkalis: R) => Promise<T>, debugOpts: DebugOptions, scraperMetadata: ScraperMetadata, cacheKey: string) {
  const debugOptions = { ...defaultDebugOptions, ...debugOpts }
  const scraperMeta = { ...defaultScraperMetadata, ...scraperMetadata }
  const logLines: string[] = []

  const identifier = `${Math.random().toString(36).substring(2, 6)}-${cacheKey}`
  const startTime = Date.now()
  log(`Starting Arkalis run for scraper ${scraperMeta.name}`)

  // add ability to cache results
  const cache = debugOptions.globalCachePath !== null && new FileSystemCache(debugOptions.globalCachePath)

  // generate a random window size
  const window = await genWindowCoords()

  // pick a proxy server (if one is required)
  const { proxy, onAuthRequired } = getProxy()

  // launch the browser
  const { browserInstance, client } = await launchBrowser()

  // create interceptor and pre-configure for http auth for proxy
  const intercept = new Intercept(client, onAuthRequired)
  await intercept.enable()

  // timezone (set either by the caller or the proxy)
  if (debugOptions.timezone)
    await client.Emulation.setTimezoneOverride({ timezoneId: debugOptions.timezone })

  // human-y mouse and keyboard control
  const mouse = new Mouse(client, window.size, debugOptions.drawMousePath)

  // used for stats and request logging
  const stats: Stats = new Stats(client, debugOptions.showRequests, (msg) => { log(msg) })

  // block requested URLs
  if (scraperMeta.blockUrls.length > 0)
    await client.Network.setBlockedURLs({ urls: scraperMeta.blockUrls })

  /////////////////////////////////

  const arkalisPublic = {
    client, log, warn, pause,
    goto, getSelectorContent, clickSelector, waitFor, evaluate,
    interceptRequest, interceptResponse,
  }

  /////////////////////////////////

  function getProxy() {
    // load proxies from env variables
    const proxies = Object.keys(process.env).reduce<Record<string, string[]>>((acc, k) => {
      if (!k.startsWith("PROXY_ADDRESS_"))
        return acc
      const groupName = k.replace("PROXY_ADDRESS_", "").toLowerCase()
      acc[groupName] = (process.env[k] ?? "").split(",")
      return acc
    }, {})

    const proxiesForScraper = proxies[scraperMeta.name] ?? proxies["default"]
    if (!debugOptions.useProxy || !proxiesForScraper || proxiesForScraper.length === 0) {
      warn("Not using proxy server!")
      return { proxy: undefined, onAuthRequired: undefined }
    }

    let proxyUrl = proxiesForScraper[Math.floor(Math.random() * proxiesForScraper.length)]!

    // if the format is `http://user:pass_country-UnitedStates_session-AAABBBCC@proxy.abcdef.io:31112`, roll the
    // proxy session id to get a new ip address
    const dynamicProxy = /http.*:\/\/.+:(?<start>\S{16}_country-\S+_session-)(?<sess>\S{8})@/u.exec(proxyUrl)
    if (dynamicProxy)
      proxyUrl = proxyUrl.replace(dynamicProxy.groups!["sess"]!, Math.random().toString(36).slice(2).substring(0, 8))

    debugOptions.timezone ??= process.env[`PROXY_TZ_${scraperMeta.name.toUpperCase()}`] ?? process.env["PROXY_TZ_DEFAULT"] ?? null

    log(c.magentaBright(`Using proxy server: ${url.parse(proxyUrl).host!} ${debugOptions.timezone !== null ? `(${debugOptions.timezone})` : ""}`))

    const onAuthRequiredFunc = (authReq: Protocol.Fetch.AuthRequiredEvent) => {
      if (authReq.authChallenge.source !== "Proxy")
        return
      if (!proxyUrl)
        return
      const auth = url.parse(proxyUrl).auth

      void client.Fetch.continueWithAuth({
        requestId: authReq.requestId,
        authChallengeResponse: {
          response: "ProvideCredentials",
          username: auth!.split(":")[0],
          password: auth!.split(":")[1]
        }
      })
    }

    return { proxy: proxyUrl, onAuthRequired: onAuthRequiredFunc }
  }

  async function genWindowCoords() {
    // pick a random window size
    const screenResolution = await new Promise<number[] | undefined>(resolve => {   // will return array of [width, height]
      exec("xdpyinfo | grep dimensions", (err, stdout) =>
        resolve(/ (?<res>\d+x\d+) /u.exec(stdout)?.[0].trim().split("x").map(num => parseInt(num)) ?? undefined))
    })
    let size = [1920, 1080]
    let pos: number[] | undefined = undefined
    if (screenResolution) {
      size = [Math.ceil(screenResolution[0]! * (Math.random() * 0.2 + 0.8)), Math.ceil(screenResolution[1]! * (Math.random() * 0.2 + 0.8))]
      pos = [Math.ceil((screenResolution[0]! - size[0]!) * Math.random()), Math.ceil((screenResolution[1]! - size[1]!) * Math.random())]
    }

    return { size, pos }
  }

  async function launchBrowser() {
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
      debugOptions.browserDebug === "verbose" ? "enable-logging=stderr": "",
      debugOptions.browserDebug === "verbose" ? "v=2" : "",
      scraperMeta.useGlobalBrowserCache ? `disk-cache-dir="${debugOptions.globalBrowserCacheDir}"` : "",
      window.pos ? `window-position=${window.pos[0]!},${window.pos[1]!}` : "",
      `window-size=${window.size[0]!},${window.size[1]!}`,
    ]

    // apply proxy
    if (proxy) {
      switches.push(`proxy-server=${url.parse(proxy).protocol!}//${url.parse(proxy).host!}`)
      switches.push(`host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE ${url.parse(proxy).hostname!}`)
    }

    // launch chrome
    const instance = await ChromeLauncher.launch({
      chromeFlags: switches.map(s => s.length > 0 ? `--${s}` : ""),
      ignoreDefaultFlags: true,
      logLevel: debugOptions.browserDebug ? "verbose" : "silent",
    })

    // connect to cdp client
    debugOptions.browserDebug && log("connecting to cdp client")
    const cdpClient = await CDP({ port: instance.port })
    await cdpClient.Network.enable()
    await cdpClient.Page.enable()
    await cdpClient.Runtime.enable()
    await cdpClient.DOM.enable()

    return { browserInstance: instance, client: cdpClient }
  }

  ////////////////////////////////////

  async function close() {
    debugOptions.browserDebug && log("closing cdp client and browser")
    await intercept.disable()

    await client.Network.disable().catch(() => {})
    await client.Page.disable().catch(() => {})
    await client.Runtime.disable().catch(() => {})
    await client.DOM.disable().catch(() => {})

    await client.Browser.close().catch(() => {})
    await client.close().catch(() => {})

    browserInstance.kill()
  }

  function log(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    logLines.push(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${prettyLine}`)
    debugOptions.log(prettyLine, identifier)
  }

  function warn(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    log(c.yellowBright("WARN"), c.yellowBright(prettyLine))
    return []
  }

  async function pause() {
    log(c.bold(c.redBright("*** paused (open browser to http://127.0.0.1:8282/vnc.html) ***")))
    // eslint-disable-next-line no-restricted-globals
    return new Promise((resolve) => setTimeout(resolve, 10000000))
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

  /** Navigates to the specified URL and returns immediately
   * @param gotoUrl - the url to navigate to */
  function goto(gotoUrl: string) {
    log(`navigating to ${gotoUrl}`)
    void client.Page.navigate({ url: gotoUrl })
  }

  async function getSelectorContent(selector: string) {
    const result = await client.Runtime.evaluate({ expression: `document.querySelector("${selector}")?.textContent`, returnByValue: true })
    return result.result.value as string | undefined
  }

  function throwIfBadResponse(statusCode: number, bodyText: string) {
    if (statusCode !== 200) {
      if (bodyText.includes("<H1>Access Denied</H1>"))
        throw new Error(`Access Denied anti-botting while loading page (status: ${statusCode})`)
      if (bodyText.includes("div class=\"px-captcha-error-header\""))
        throw new Error("Perimeter-X captcha anti-botting while loading page")
      log(bodyText)

      throw new Error(`Page loading failed with status ${statusCode}`)
    }
  }

  /** Waits for a url to be loaded or specific html to be present
   * @param items - a map of name to url/html to wait for. when waiting for a url, optionally passing a `statusCode`
   * will wait only trigger on that http status code, unless the expected code is 200 in which case the request will be
   * validated */
  async function waitFor(items: Record<string, WaitForType>): Promise<WaitForReturn> {
    const subscriptions: (() => void)[] = []
    const pollingTimers: NodeJS.Timer[] = []
    let timeout: NodeJS.Timeout | undefined

    try {
      const promises = Object.entries(items).map(async ([name, params]): Promise<WaitForReturn> => {
        switch (params.type) {
          case "url":
            return new Promise((resolve, reject) => {
              let resultResponse: Protocol.Network.Response
              let lookingForRequestId: string | undefined = undefined
              const urlRegexp = typeof params.url === "string" ? globToRegexp(params.url, { extended: true }) : params.url

              // The request first comes in as headers only
              subscriptions.push(client.Network.responseReceived((response) => {
                if (urlRegexp.test(response.response.url) && response.type !== "Preflight" &&
                    (params.statusCode === undefined || params.statusCode === 200 || params.statusCode === response.response.status)) {
                  lookingForRequestId = response.requestId
                  resultResponse = response.response
                }
              }))

              // Then the body comes in via Network.dataReceived and finishes with Network.loadingFinished
              subscriptions.push(client.Network.loadingFinished(async (response) => {
                if (lookingForRequestId === response.requestId) {
                  const responseResult = await client.Network.getResponseBody({ requestId: lookingForRequestId })
                  if (params.statusCode === 200)    // do extra verifications if expecting a success
                    throwIfBadResponse(resultResponse.status, responseResult.body) // TODO: STILL NEEDS FIXING .catch((e: Error) => reject(e))
                  resolve({name, response: {...resultResponse, body: responseResult.body}})
                }
              }))
            })

          case "html":
            return new Promise<{name: string}>((resolve, reject) => {
              const htmlRegexp = typeof params.html === "string" ? globToRegexp(params.html, { extended: true, flags: "ugm" }) : params.html
              // eslint-disable-next-line no-restricted-globals
              pollingTimers.push(setInterval(async () => {
                const evalResult = await client.Runtime.evaluate(
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
                const doc = await client.DOM.getDocument({ depth: -1 })
                const node = await client.DOM.querySelector({ nodeId: doc.root.nodeId, selector: params.selector })
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
          if (Date.now() - stats.lastResponseTime >= scraperMeta.defaultTimeoutMs) {
            resolve({name: "timeout"})
          } else {
            timeout = setTimeout(() => timeoutHandler(), scraperMeta.defaultTimeoutMs - (Date.now() - stats.lastResponseTime))
          }
        }
        timeout = setTimeout(() => timeoutHandler(), scraperMeta.defaultTimeoutMs)
        /* eslint-enable no-restricted-globals */
      }))

      const result = await Promise.race(promises)
      if (result.name === "timeout")
        throw new Error(`Timeout waiting for items (${scraperMeta.defaultTimeoutMs} ms})`)

      return result

    } finally {
      subscriptions.forEach((unsub) => unsub())
      pollingTimers.forEach((timer) => clearInterval(timer))
      if (timeout) clearTimeout(timeout)
    }
  }

  async function evaluate<ReturnType>(expression: string) {
    const result = await client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true })
    return result.result.value as ReturnType
  }

  async function clickSelector(selector: string) {
    return mouse.clickSelector(selector)
  }

  function interceptRequest(urlPattern: string, callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    intercept.add(globToRegexp(urlPattern, { extended: true }), "Request", callback)
  }

  function interceptResponse(urlPattern: string, callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    intercept.add(globToRegexp(urlPattern, { extended: true }), "Response", callback)
  }

  function prettifyArgs(args: any[]) {
    if (typeof args === "string")
      return args
    return args.map((item: any) => typeof item === "string"
      ? item
      : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
  }

  async function run() {
    // Use a previously cached response if available
    const resultCacheTtlMs = scraperMeta.resultCacheTtlMs ?? debugOptions.defaultResultCacheTtl
    if (cache && debugOptions.useResultCache && resultCacheTtlMs > 0) {
      const existingCache = await cache.get<T>(`result-${cacheKey}`)
      if (existingCache) {
        log(`Found and using cached result for ${cacheKey}`)
        return { result: existingCache, logLines }
      }
    }

    // **NOTE**: be careful doing any more logic after here because this code will NOT be run if a cache hit happened.
    const result = await code(arkalisPublic as R)

    // Store the successful result into cache
    if (cache && debugOptions.useResultCache && resultCacheTtlMs > 0)
      await cache.set(`result-${cacheKey}`, result, resultCacheTtlMs)

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

    throw error

  }).finally(async () => {
    if (success && debugOptions.pauseAfterRun)
       await pause()

    const successText = success ? c.greenBright("SUCCESSFULLY") : c.redBright("UNSUCCESSFULLY")
    log(`Completed attempt ${successText} in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${stats.toString().summary})`)
    logAttemptResult(!success)
    await close()
  })
}

export async function runArkalis<T>(code: (arkalis: Arkalis) => Promise<T>, debugOpts: DebugOptions, scraperMetadata: ScraperMetadata, cacheKey: string) {
  const logLines: string[] = []

  function log(...args: any[]) {
    const prettyLine = args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")
    logLines.push(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}] ${prettyLine}`)
    ;(debugOpts.log ?? defaultDebugOptions.log)(prettyLine, "-")
  }

  return pRetry(async() => {
    const attemptResult = await runArkalisAttempt(code, debugOpts, scraperMetadata, cacheKey)
    logLines.push(...attemptResult.logLines)
    return { result: attemptResult.result, logLines }

  }, { minTimeout: 0, maxTimeout: 0, retries: (debugOpts.maxAttempts ?? defaultDebugOptions.maxAttempts) - 1, onFailedAttempt: (error) => {
    log(c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]!}`))

  } }).catch(e => {
    return { result: undefined, logLines }
  })
}
