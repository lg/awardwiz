import CDP from "chrome-remote-interface"
import { logGlobal } from "./log.js"
import pRetry from "p-retry"
import path from "node:path"
import { default as globToRegexp } from "glob-to-regexp"
import fs from "node:fs/promises"
import { ChildProcess, exec } from "node:child_process"
import { Protocol } from "devtools-protocol"

export type WaitForType =
  { type: "url", url: string | RegExp, statusCode?: number } |
  { type: "html", html: string | RegExp }
export type WaitForReturn =
  { name: string, response: any } |
  { name: string } |
  { name: "timeout" }

export class CDPBrowser {
  private firefox?: ChildProcess
  public client!: CDP.Client
  private context?: Protocol.Runtime.ExecutionContextDescription

  async launch(pathToFirefox: string, profilePath: string, addPrefs: Record<string, any>) {
    const defaultToAdd: Record<string, any> = {
      "remote.prefs.recommended": false,          // start false and change the settings that you REALLY need
      "remote.active-protocols": 2,               // no BiDi
      "fission.bfcacheInParent": false,           // oddly necessary to get navigation to work
      "fission.webContentIsolationStrategy": 0,   // oddly necessary to get navigation to work

      "browser.startup.homepage": "about:blank",
      "browser.startup.homepage_override.mstone": "ignore",
      "browser.startup.page": 0,

      // double checked safe
      "app.normandy.api_url": "", "app.update.checkInstallTime": false, "app.update.disabledForTesting": true,
      "browser.pagethumbnails.capturing_disabled": true, "browser.search.update": false,
      "browser.sessionstore.resume_from_crash": false, "browser.shell.checkDefaultBrowser": false,
      "browser.urlbar.suggest.searches": false, "browser.usedOnWindows10.introURL": "",
      "datareporting.healthreport.service.enabled": false, "datareporting.policy.dataSubmissionEnabled": false,
      "media.gmp-manager.updateEnabled": false,

      // useful and probably safe
      "browser.dom.window.dump.enabled": true, "browser.tabs.disableBackgroundZombification": false,
      "browser.tabs.warnOnCloseOtherTabs": false, "browser.tabs.warnOnOpen": false, "browser.warnOnQuit": false,
      "javascript.options.showInConsole": true, "network.manage-offline-status": false,
      "security.notification_enable_delay": 0, "signon.autofillForms": false, "signon.rememberSignons": false,
      "toolkit.startup.max_resumed_crashes": -1,

      // risky for detection
      // "focusmanager.testmode": true, "general.useragent.updates.enabled": false, "geo.provider.testing": true,
      // "geo.wifi.scan": false, "privacy.trackingprotection.enabled": false,
      // "toolkit.cosmeticAnimations.enabled": false,
    }

    // wipe profile
    const useProfilePath = profilePath //`${profilePath}-${Math.random().toString(36).slice(2)}`
    await fs.mkdir(useProfilePath, { recursive: true })
    const userJsPath = path.join(useProfilePath, "user.js")
    await fs.writeFile(userJsPath, Object.entries({...defaultToAdd, ...addPrefs}).map(([k, v]) => `user_pref("${k}", ${JSON.stringify(v)});`).join("\n"))

    const cmd = `${pathToFirefox} --remote-debugging-port 9222 --new-instance --profile ${useProfilePath} 2>&1`
    logGlobal(`launching: ${cmd}`)
    this.firefox = exec(cmd)
    this.firefox.stdout!.on("data", (data) => logGlobal("O", data.toString()))
    process.on("exit", () => this.firefox?.kill("SIGKILL"))

    logGlobal("connecting to cdp client")
    this.client = await pRetry(async () => CDP(), { forever: true, maxTimeout: 1000 })
    await this.client.Network.enable()
    await this.client.Page.enable()
    await this.client.Runtime.enable()

    logGlobal("ready")
  }

  async close() {
    await this.client.Browser.close()
    await this.client.close()
  }

  async goto(url: string) {
    logGlobal(`navigating to ${url}`)
    void this.client.Page.navigate({ url })
  }

  async waitFor(items: Record<string, WaitForType>, timeoutMs: number): Promise<WaitForReturn> {
    const subscriptions: Function[] = []
    const pollingTimers: NodeJS.Timer[] = []
    let timeout: NodeJS.Timeout | undefined

    try {
      const promises = Object.entries(items).map(([name, params]) => {
        switch (params.type) {
          case "url":
            return new Promise<{name: string, response: object}>((resolve) => {
              const urlRegexp = typeof params.url === "string" ? globToRegexp(params.url, { extended: true }) : params.url
              subscriptions.push(this.client.Network.responseReceived(({ response }) => {
                if (urlRegexp.test(response.url) && (params.statusCode === undefined || response.status === params.statusCode))
                  resolve({name, response})
              }))
            })

          case "html":
            return new Promise<{name: string}>((resolve) => {
              const htmlRegexp = typeof params.html === "string" ? globToRegexp(params.html, { extended: true }) : params.html
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
        timeout = setTimeout(() => resolve({name: "timeout"}), timeoutMs)
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
