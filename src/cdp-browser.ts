import tmp from "tmp-promise"
import { ChildProcess, exec } from "node:child_process"
import CDP from "chrome-remote-interface"
import type { Protocol } from "chrome-remote-interface/node_modules/devtools-protocol/types/protocol.js"
import pRetry from "p-retry"
import globToRegexp from "glob-to-regexp"
import { TypedEmitter } from "tiny-typed-emitter"
import c from "ansi-colors"
import url from "node:url"

export type WaitForType = { type: "url", url: string | RegExp, statusCode?: number } | { type: "html", html: string | RegExp }
export type WaitForReturn = { name: string, response?: any }
type Request = { requestId: string, request?: Protocol.Network.Request, response?: Protocol.Network.Response, downloadedBytes: number, startTime?: number, endTime?: number, success?: boolean }

interface CDPBrowserEvents {
  "browser_message": (message: string) => void,
  "message": (message: string) => void,
}

export type CDPBrowserOptions = {
  proxy: string | undefined
}
export class CDPBrowser extends TypedEmitter<CDPBrowserEvents> {
  private browserInstance?: ChildProcess
  private requests: Record<string, Request> = {}
  public client!: CDP.Client
  public defaultTimeoutMs = 30_000

  async launch(options: CDPBrowserOptions) {
    const switches = [
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

      // "disable-blink-features=AutomationControlled", // not working
      // "auto-open-devtools-for-tabs",

      //"enable-logging=stderr --v=2",
      "disk-cache-dir=\"./tmp/chrome-cache\"",
      `user-data-dir="${(await tmp.dir({ unsafeCleanup: true })).path}"`,
      "window-position=0,0",
      "window-size=1600,1024",
      "remote-debugging-port=9222"
    ]

    if (options.proxy) {
      switches.push(`proxy-server='${options.proxy}'`)
      switches.push(`host-resolver-rules='MAP * ~NOTFOUND , EXCLUDE ${url.parse(options.proxy).hostname}'`)
    }

    const cmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ${switches.map(s => `--${s}`).join(" ")}`

    this.emit("browser_message", `launching ${cmd}`)
    this.browserInstance = exec(cmd)
    ;[this.browserInstance.stdout!, this.browserInstance.stderr!].forEach((std) =>
      std.on("data", (data) => this.emit("browser_message", data.toString().trim())))
    process.on("exit", () => this.browserInstance?.kill("SIGKILL"))

    this.emit("browser_message", "connecting to cdp client")
    this.client = await pRetry(async () => CDP(), { forever: true, maxTimeout: 1000, maxRetryTime: this.defaultTimeoutMs })
    await this.client.Network.enable()
    await this.client.Page.enable()
    await this.client.Runtime.enable()

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
  }

  private completedLoading(requestId: string) {
    const item = this.requests[requestId]!
    if (!this.requests[requestId]?.request?.method)
      return

    const line =
      `${item.response?.status ? c.green(item.response.status.toString()) : c.red("BLK")} ` +
      `${item.response?.fromDiskCache ? c.yellowBright("CACHE") : (Math.ceil(item.downloadedBytes / 1024).toString() + "kB").padStart(5, " ")} ` +
      `${item.request?.method.padEnd(4, " ").slice(0, 4)} ` +
      `${c.white(item.request!.url)} ` +
      `${c.yellowBright(item.response?.headers["cache-control"] ?? "")}`
    this.emit("message", line)
  }

  async close() {
    this.emit("browser_message", "closing cdp client and browser")
    await this.client.Browser.close()
    await this.client.close()
  }

  async goto(gotoUrl: string) {
    this.emit("message", `navigating to ${gotoUrl}`)
    return this.client.Page.navigate({ url: gotoUrl })
  }

  async waitFor(items: Record<string, WaitForType>): Promise<WaitForReturn> {
    const subscriptions: Function[] = []
    const pollingTimers: NodeJS.Timer[] = []
    let timeout: NodeJS.Timeout | undefined

    try {
      const promises = Object.entries(items).map(([name, params]) => {
        switch (params.type) {
          case "url":
            return new Promise<{name: string, response: object}>((resolve) => {
              let resultResponse = {} as any
              let lookingForRequestId: string | undefined = undefined
              const urlRegexp = typeof params.url === "string" ? globToRegexp(params.url, { extended: true }) : params.url

              // The request first comes in as headers only
              subscriptions.push(this.client.Network.responseReceived(async (response) => {
                if (urlRegexp.test(response.response.url) && response.type !== "Preflight" && (params.statusCode === undefined || response.response.status === params.statusCode)) {
                  lookingForRequestId = response.requestId
                  resultResponse = response.response
                }
              }))

              // Then the body comes in via Network.dataReceived and finishes with Network.loadingFinished
              subscriptions.push(this.client.Network.loadingFinished(async (response) => {
                if (lookingForRequestId === response.requestId) {
                  const responseResult = await this.client.Network.getResponseBody({ requestId: lookingForRequestId })
                  if (params.statusCode === 200)    // do extra verifications if expecting a success
                    this.throwIfBadResponse(resultResponse.status, responseResult.body)
                  resolve({name, response: {...resultResponse, body: responseResult.body}})
                }
              }))
            })

          case "html":
            return new Promise<{name: string}>((resolve) => {
              const htmlRegexp = typeof params.html === "string" ? globToRegexp(params.html, { extended: true, flags: "ugm" }) : params.html
              // eslint-disable-next-line no-restricted-globals
              pollingTimers.push(setInterval(async () => {
                const evalResult = await this.client.Runtime.evaluate({ expression: "document.documentElement.outerHTML", returnByValue: true })
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

  private throwIfBadResponse(statusCode: number, bodyText: string) {
    if (statusCode !== 200) {
      if (bodyText.includes("<H1>Access Denied</H1>"))
        throw new Error(`Access Denied anti-botting while loading page (status: ${statusCode})`)
      if (bodyText.includes("div class=\"px-captcha-error-header\""))
        throw new Error("Perimeter-X captcha anti-botting while loading page")
      this.emit("message", bodyText)

      throw new Error(`Page loading failed with status ${statusCode}`)
    }
  }

  public stats() {
    const totRequests = Object.values(this.requests).length
    const cacheHits = Object.values(this.requests).filter((request) => request.response?.fromDiskCache).length
    const cacheMisses = totRequests - cacheHits
    const bytes = Object.values(this.requests).reduce((bytes, request) => (bytes += request.downloadedBytes), 0)

    const summary = `${totRequests.toLocaleString()} reqs, ${cacheHits.toLocaleString()} hits, ${cacheMisses.toLocaleString()} misses, ${bytes.toLocaleString()} bytes`
    return { totRequests, cacheHits, cacheMisses, bytes, summary }
  }

  public async blockUrls(urls: string[]) {
    await this.client.Network.setBlockedURLs({ urls })
  }
}
