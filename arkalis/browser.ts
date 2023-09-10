import url from "node:url"
import { Arkalis, ArkalisCore } from "./arkalis.js"
import Bun from "bun"
import path from "node:path"

// Hack of the century right here to get chrome-remote-interface to use a Bun-compatible websocket wrapper
const patchPath = "node_modules/chrome-remote-interface/lib/chrome.js"
await Bun.write(patchPath, (await Bun.file(patchPath).text()).replace(/\('ws'\)/gu, "('./websocket-wrapper.js')"))
const CDP = await import("chrome-remote-interface")

const launchChromeViaOsRunDocker = async (arkalis: ArkalisCore, switches: string[]) => {
  switches.push(...[
    "user-data-dir=c:\\chrome-user-data",
    arkalis.scraperMeta.useGlobalBrowserCache ? "disk-cache-dir=\"\\\\10.0.2.4\\qemu\\chrome-cache\"" : "",
  ].filter(s => s !== ""))

  const command =
    "netsh interface portproxy add v4tov4 listenaddress=10.0.2.15 listenport=9222 connectaddress=127.0.0.1 connectport=9222 " +
    ` & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ${switches.map(s => s.length > 0 ? `--${s}` : "").join(" ")} about:blank`

  const dockerCommand = ["docker", "run",
    "--interactive",
    "--rm",
    "--name", `arkalis-${arkalis.identifier}`,
    "--publish", "9222:9222",
    "--publish", "8000:8000",
    "--env", "TZ=America/Los_Angeles",
    "--volume", "/osruncache:/cache",
    ...arkalis.scraperMeta.useGlobalBrowserCache
      ? ["--volume", `${path.resolve(arkalis.debugOptions.globalBrowserCacheDir)}:/tmp/qemu-status/chrome-cache`] : [""],
    "--device", "/dev/kvm",

    "ghcr.io/lg/osrun",
    "-f", "9222",
    "-v",
    `${command}`
  ]
  arkalis.debugOptions.browserDebug && arkalis.log(`Launching docker with command: ${dockerCommand.join(" ")}`)
  const proc = Bun.spawn(dockerCommand, { stdin: "inherit", stdout: "pipe", stderr: "pipe" })

  arkalis.debugOptions.browserDebug && arkalis.log("Waiting for chrome to be ready on port 9222")
  let client = undefined
  while ((client = await CDP.default({ port: 9222 }).catch(() => undefined)) === undefined)
    await arkalis.wait(200)
  arkalis.debugOptions.browserDebug && arkalis.log("Chrome ready on port 9222")

  return {
    client,
    closeBrowser: async () => {
      await closeCDPClient(arkalis)
      await new Response(proc.stdout).text()
      await new Response(proc.stderr).text()
      proc.kill()
    }
  }
}

const closeCDPClient = async (arkalis: ArkalisCore) => {
  arkalis.debugOptions.browserDebug && arkalis.log("Closing cdp client")

  for (const domain of [arkalis.client.Network, arkalis.client.Page, arkalis.client.Runtime, arkalis.client.DOM])
    await domain.disable().catch(() => {})
  await arkalis.client.Browser.close().catch(() => {})
  await arkalis.client.close().catch(() => {})
}

export const arkalisBrowser = async (arkalis: ArkalisCore) => {
  // these domains are used by the browser when creating a new profile
  const blockDomains = [
    "accounts.google.com", "clients2.google.com", "optimizationguide-pa.googleapis.com", "edgedl.me.gvt1.com",
    "content-autofill.googleapis.com", "update.googleapis.com"
  ]

  const switches = [
    // these should all be undetectable, but speed things up
    "disable-features=OptimizationHints,MediaRouter,AutofillServerCommunication,CertificateTransparencyComponentUpdater,CalculateNativeWinOcclusion,InterestFeedContentSuggestions,Translate",
    "disable-sync", "disable-backgrounding-occluded-windows", "disable-breakpad", "disable-renderer-backgrounding",
    "disable-domain-reliability", "disable-background-networking", "disable-background-timer-throttling",
    "enable-crash-reporter-for-testing", "no-service-autorun", "disable-ipc-flooding-protection", "password-store=basic",
    "no-first-run", "no-default-browser-check", "disable-prompt-on-repost", "disable-client-side-phishing-detection",
    "disable-hang-monitor", "autoplay-policy=no-user-gesture-required", "use-mock-keychain", "disable-omnibox-autocomplete-off-method",
    "disable-gaia-services", "disable-crash-reporter", "noerrdialogs", "disable-component-update",
    "metrics-recording-only", "disable-component-update", "enable-precise-memory-info",
    "force-fieldtrials=*BackgroundTracing/default/",

    // "no-sandbox", "disable-dev-shm-usage",  // for linux docker
    // "auto-open-devtools-for-tabs",
    //"log-net-log=./tmp/netlog.json", "net-log-capture-mode=Everything",

    // store the logs just incase we beed them
    "enable-logging=stderr", "v=2",
    // arkalis.scraperMeta.useGlobalBrowserCache ? `disk-cache-dir=${arkalis.debugOptions.globalBrowserCacheDir}` : "",
    // `window-position=${window.pos[0]},${window.pos[1]}`,
    // `window-size=${window.size[0]},${window.size[1]}`,
    `host-rules="${blockDomains.map(blockDomain => `MAP ${blockDomain} 0.0.0.0`).join(", ")}"`,   // NOTE: detectable!

    "remote-debugging-port=9222"
  ].filter(s => s !== "")

  // apply proxy
  const proxy = (arkalis as Arkalis).proxy
  if (proxy) {
    const parsedProxy = url.parse(proxy)
    if (!parsedProxy.hostname || !parsedProxy.protocol || !parsedProxy.host)
      throw new Error(`Invalid proxy: ${proxy}`)
    switches.push(`proxy-server="${parsedProxy.protocol}//${parsedProxy.host}"`)
    switches.push(`host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${parsedProxy.hostname}"`)
  }

  // launch chrome
  const { closeBrowser, client } = await launchChromeViaOsRunDocker(arkalis, switches)
  arkalis.client = client

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
    close: closeBrowser
  }
}
