import { exec } from "node:child_process"
import url from "node:url"
import ChromeLauncher from "chrome-launcher"
import { Arkalis, ArkalisCore } from "./arkalis.js"
import CDP from "chrome-remote-interface"

export const arkalisBrowser = async (arkalis: ArkalisCore) => {
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

  // generate a random window size
  const window = await genWindowCoords()

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

    arkalis.debugOptions.browserDebug === "verbose" ? "enable-logging=stderr": "",
    arkalis.debugOptions.browserDebug === "verbose" ? "v=2" : "",
    arkalis.scraperMeta.useGlobalBrowserCache ? `disk-cache-dir=${arkalis.debugOptions.globalBrowserCacheDir}` : "",
    window.pos ? `window-position=${window.pos[0]!},${window.pos[1]!}` : "",
    `window-size=${window.size[0]!},${window.size[1]!}`,
    `host-rules=${blockDomains.map(blockDomain => `MAP ${blockDomain} 0.0.0.0`).join(", ")}`,   // NOTE: detectable!
  ]

  // apply proxy
  const proxy = (arkalis as Arkalis).proxy
  if (proxy) {
    switches.push(`proxy-server=${url.parse(proxy).protocol!}//${url.parse(proxy).host!}`)
    switches.push(`host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE ${url.parse(proxy).hostname!}`)
  }

  // launch chrome
  const instance = await ChromeLauncher.launch({
    chromeFlags: switches.map(s => s.length > 0 ? `--${s}` : ""),
    ignoreDefaultFlags: true,
    logLevel: arkalis.debugOptions.browserDebug ? "verbose" : "silent",
  })

  // connect to cdp client
  arkalis.debugOptions.browserDebug && arkalis.log("connecting to cdp client")
  arkalis.client = await CDP({ port: instance.port })
  await arkalis.client.Network.enable()
  await arkalis.client.Page.enable()
  await arkalis.client.Runtime.enable()
  await arkalis.client.DOM.enable()

  // timezone (set either by the caller or the proxy)
  if (arkalis.debugOptions.timezone)
    await arkalis.client.Emulation.setTimezoneOverride({ timezoneId: arkalis.debugOptions.timezone })

  // block requested URLs
  if (arkalis.scraperMeta.blockUrls.length > 0)
    await arkalis.client.Network.setBlockedURLs({ urls: arkalis.scraperMeta.blockUrls })

  return {
    window,
    close: async () => {
      arkalis.debugOptions.browserDebug && arkalis.log("closing cdp client and browser")

      await arkalis.client.Network.disable().catch(() => {})
      await arkalis.client.Page.disable().catch(() => {})
      await arkalis.client.Runtime.disable().catch(() => {})
      await arkalis.client.DOM.disable().catch(() => {})

      await arkalis.client.Browser.close().catch(() => {})
      await arkalis.client.close().catch(() => {})

      instance.kill()
    }
  }
}
