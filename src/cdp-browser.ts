import tmp from "tmp-promise"
import { logGlobal } from "./log.js"
import c from "ansi-colors"
import { ChildProcess, exec } from "node:child_process"
import CDP from "chrome-remote-interface"
import pRetry from "p-retry"
import globToRegexp from "glob-to-regexp"

export type WaitForType = { type: "url", url: string | RegExp, statusCode?: number } | { type: "html", html: string | RegExp }
export type WaitForReturn = { name: string, response?: any }

export class CDPBrowser {
  private browserInstance?: ChildProcess
  public client!: CDP.Client
  public defaultTimeoutMs = 30_000

  async launch() {
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
      // "silent-launch",

      //"enable-logging=stderr --v=2",
      // "disk-cache-dir=\"./tmp/chrome-cache\"",
      `user-data-dir="${(await tmp.dir({ unsafeCleanup: true })).path}"`,
      "window-position=0,0",
      "window-size=1600,1024",
      "remote-debugging-port=9222",
      // "proxy-server='socks5://10.0.1.96:32005'",
      // "host-resolver-rules='MAP * ~NOTFOUND , EXCLUDE 10.0.1.96'",
    ]
    const cmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ${switches.map(s => `--${s}`).join(" ")}`

    logGlobal("launching", c.greenBright(cmd))
    this.browserInstance = exec(cmd)
    // this.browserInstance.stdout!.on("data", (data) => logGlobal("O", data.toString()))
    // this.browserInstance.stderr!.on("data", (data) => logGlobal("E", data.toString()))
    process.on("exit", () => this.browserInstance?.kill("SIGKILL"))

    logGlobal("connecting to cdp client")
    this.client = await pRetry(async () => CDP(), { forever: true, maxTimeout: 1000, maxRetryTime: this.defaultTimeoutMs })
    await this.client.Network.enable()
    await this.client.Page.enable()
    await this.client.Runtime.enable()
  }

  async close() {
    logGlobal("closing cdp client and browser")
    await this.client.Browser.close()
    await this.client.close()
  }

  async goto(url: string) {
    logGlobal(`navigating to ${url}`)
    return this.client.Page.navigate({ url })
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
}
