import { logger, logGlobal } from "./log.js"
import { firefox, chromium, webkit } from "playwright-extra"
import { DebugOptions, Scraper } from "./scraper.js"
import { BrowserType } from "playwright"
import { DatacenterIpCheck, FP, NewDetectionTests, OldTests, TcpIpFingerprint, TLSFingerprint } from "./types.js"
import { fetch } from "cross-fetch"
import os from "node:os"
import pako from "pako"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"
dayjs.extend(utc)
dayjs.extend(timezone)

const debugOptions: DebugOptions = {
  showBrowserDebug: false,
  maxAttempts: 5,
  minBrowserPool: 1,
  maxBrowserPool: 1,

  showBlocked: false,
  showFullRequest: [],
  showFullResponse: [],
  useProxy: true,

  showUncached: true,
  pauseAfterRun: false,
  pauseAfterError: true,

  tracingPath: "./tmp/traces",
}

//////////////////////////

const ULIXEE_URL_BY_OS_AND_BROWSER: Record<string, Record<string, string>> = {
  "Windows NT": { "firefox": "windows-11--firefox-108-0", "chromium": "windows-11--chrome-109-0", "webkit": "mac-os-12--safari-15-6" },
  "Linux": { "firefox": "windows-11--firefox-108-0", "chromium": "windows-11--chrome-109-0", "webkit": "mac-os-12--safari-15-6" },
  "Darwin": { "firefox": "mac-os-13--firefox-108-0", "chromium": "mac-os-13--chrome-109-0", "webkit": "mac-os-12--safari-15-6" }
}

const getDomDefaults = async (osType: string, browser: BrowserType) => {
  const osAndBrowser = ULIXEE_URL_BY_OS_AND_BROWSER[osType]![browser.name()]
  const url = `https://github.com/ulixee/browser-profile-data/raw/main/profiles/${osAndBrowser}/browser-dom-environment--https.json.gz`

  const gzippedResponse = await fetch(url)
  const buffer = await gzippedResponse.arrayBuffer()
  const text = new TextDecoder("utf-8").decode(pako.inflate(buffer))
  const raw = JSON.parse(text)

  const navigatorProperties = [
    ...Object.keys(raw.data.window.Navigator.prototype).filter(check => !["_$protos", "Symbol(Symbol.toStringTag)", "_$type", "_$flags"].includes(check)),
    "constructor", "toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
    "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__", "__proto__", "constructor"
  ]

  return { navigatorProperties, raw }
}

logGlobal(`downloading dom defaults for chrome, firefox and safari for ${os.type()}`)
const domDefaults: Record<string, any> = {
  "chromium": await getDomDefaults(os.type(), chromium),
  "firefox": await getDomDefaults(os.type(), firefox),
  "webkit": await getDomDefaults(os.type(), webkit)
}

const runIncolumnitas = async (browserType: BrowserType) => {
  const browser = new Scraper(browserType, { ...debugOptions, useProxy: false })
  await browser.create()

  const problems = await browser.runAttempt(async (sc) => {
    sc.context?.setDefaultNavigationTimeout(60000)
    sc.context?.setDefaultTimeout(60000)

    // load the page and scroll to the bottom such that all tests run
    await sc.page.goto("https://bot.incolumitas.com/", { waitUntil: "networkidle" })
    while (!await sc.page.locator("#fp").isVisible()) {
      await sc.page.waitForTimeout(500)
      await sc.page.mouse.wheel(0, 100)
    }
    sc.log("waiting for tests to finish")
    await sc.page.waitForFunction(() => !document.querySelector("#detection-tests")?.textContent!.includes("\"fpscanner\": {}"))

    // collect results
    const newTests: NewDetectionTests = JSON.parse(await sc.page.locator("#new-tests").textContent() ?? "{}")
    const oldTestsIntoli: OldTests["intoli"] = JSON.parse(await sc.page.locator("#detection-tests").textContent() ?? "{}").intoli
    const oldTestsFpscanner: OldTests["fpscanner"] = JSON.parse(await sc.page.locator("#detection-tests").textContent() ?? "{}").fpscanner
    const datacenter: DatacenterIpCheck = JSON.parse(await sc.page.locator("#datacenter-ip-api-data").textContent().catch(() => undefined) ?? "{}")
    const tcpipFingerprint: TcpIpFingerprint = JSON.parse(await sc.page.locator("#p0f").textContent().catch(() => undefined) ?? "{}")
    const tlsFingerprint: TLSFingerprint = JSON.parse(await sc.page.locator("#tls-fingerprint").textContent().catch(() => undefined) ?? "{}")
    const fp: FP = JSON.parse(await sc.page.locator("#fp").textContent().catch(() => undefined) ?? "{}")

    const problems = [
      ...Object.entries(newTests).filter(([k, v]) => v === "FAIL").map(([k, v]) => `new-tests.${k} = ${v}`),
      ...Object.entries(oldTestsIntoli).filter(([k, v]) => v === "FAIL").map(([k, v]) => `intoli.${k} = ${v}`),
      ...Object.entries(oldTestsFpscanner).filter(([k, v]) => v === "FAIL").map(([k, v]) => `fpscanner.${k} = ${v}`),
      ...["is_bogon", "is_datacenter", "is_tor", "is_proxy", "is_vpn", "is_abuser"].map(k => datacenter[k as keyof DatacenterIpCheck] === false ? undefined : `datacenter.${k} = ${datacenter[k as keyof DatacenterIpCheck] as string}`),
      datacenter.asn.type !== "isp" ? `datacenter.asn.type = ${datacenter.asn.type} (not "isp")` : undefined,
      tcpipFingerprint.details.os_mismatch ? `tcpip-fingerprint.os_mismatch = ${tcpipFingerprint.details.os_mismatch} (wasn't expecting ${tcpipFingerprint.details.os_highest_class})` : undefined,
      fp.webDriver ? `fp.webDriver = ${fp.webDriver}` : undefined,
      fp.selenium.some((item) => item) ? `fp.selenium = ${fp.selenium}` : undefined,
      fp.phantomJS.some((item) => item) ? `fp.phantomJS = ${fp.phantomJS}` : undefined,
      fp.nightmareJS ? `fp.nightmareJS = ${fp.nightmareJS}` : undefined,
      fp.domAutomation ? `fp.domAutomation = ${fp.domAutomation}` : undefined,
      fp.debugTool ? `fp.debugTool = ${fp.debugTool}` : undefined,
      fp.timezone !== fp.getTimezoneOffset ? `fp.oscpu = ${fp.timezone} (was expecting same as fp.getTimezoneOffset: ${fp.getTimezoneOffset})` : undefined,
      datacenter.location.timezone !== dayjs().tz(fp.timezone2).format("Z") ? `datacenter.location.timezone = ${datacenter.location.timezone} (was expecting ${dayjs().tz(fp.timezone2).format("Z")} as per ip from fp)` : undefined,
      fp.userAgent === tlsFingerprint["user-agent"] ? undefined : `fp.userAgent = ${fp.userAgent} (was expecting same as tlsFingerprint.user-agent]: ${tlsFingerprint["user-agent"]})`,
      fp.navigatorProperties.join(",") === domDefaults[browserType.name()].navigatorProperties.join(",") ? undefined : `fp.navigatorProperties = MISMATCH (vs the expected items in ${ULIXEE_URL_BY_OS_AND_BROWSER[os.type()]![browserType.name()]})`,
    ]

    // logGlobal(problems.filter(p => p !== undefined))
    // logGlobal("waiting")
    // debugger

    return problems.filter(p => p !== undefined)
  }, { name: "incolumitas", useAdblockLists: false, useCache: false }, `incolumitas-${browserType.name()}`)
  await browser.destroy()

  return problems
}

//////////////////////////

const problems = []

for (const browserType of [firefox, chromium /*, webkit*/]) {
  logGlobal(`running Incolumnitas for ${browserType.name()}:`)
  const runProblems = (await runIncolumnitas(browserType)).map(p => `${browserType.name()}.${p}`)
  problems.push(...runProblems)
  logGlobal(runProblems)
}

logGlobal("done")
logger.close()
