import { logger, logGlobal } from "./log.js"
import { DebugOptions, Scraper } from "./scraper.js"
import { DatacenterIpCheck, FP, NewDetectionTests, OldTests, TcpIpFingerprint } from "./types.js"
import os from "node:os"
import pako from "pako"
import { fetchBuilder, FileSystemCache } from "node-fetch-cache"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"
dayjs.extend(utc)
dayjs.extend(timezone)

const debugOptions: DebugOptions = {
  maxAttempts: 5,
  pauseAfterRun: false,
  pauseAfterError: true,
  useProxy: false,
}

//////////////////////////

const ULIXEE_URL_BY_OS_AND_BROWSER: Record<string, string> = {
  "Windows NT": "windows-11--chrome-110-0",
  "Linux": "windows-11--chrome-110-0",
  "Darwin": "mac-os-13--chrome-110-0",
}

const getDomDefaults = async (osType: string) => {
  const osAndBrowser = ULIXEE_URL_BY_OS_AND_BROWSER[osType]
  const url = `https://github.com/ulixee/browser-profile-data/raw/main/profiles/${osAndBrowser}/browser-dom-environment--https.json.gz`
  const fetch = fetchBuilder.withCache(new FileSystemCache({ cacheDirectory: "./tmp" }))
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

logGlobal(`downloading dom defaults for ${os.type()}`)
const domDefaults = await getDomDefaults(os.type())

const runIncolumnitas = async () => {
  const browser = new Scraper(debugOptions)

  const problems = await browser.run(async (sc) => {
    await sc.browser.goto("https://bot.incolumitas.com/")

    sc.log("waiting for tests to finish")
    await sc.browser.waitFor({ "fingerprint": { type: "html", html: /"fpscanner": \{\n/gu } })

    const newTests: NewDetectionTests = JSON.parse(await sc.browser.getSelectorContent("#new-tests") ?? "{}")
    const oldTestsIntoli: OldTests["intoli"] = JSON.parse(await sc.browser.getSelectorContent("#detection-tests") ?? "{}").intoli
    const oldTestsFpscanner: OldTests["fpscanner"] = JSON.parse(await sc.browser.getSelectorContent("#detection-tests") ?? "{}").fpscanner
    const datacenter: DatacenterIpCheck = JSON.parse(await sc.browser.getSelectorContent("#datacenter-ip-api-data").catch(() => undefined) ?? "{}")
    const tcpipFingerprint: TcpIpFingerprint = JSON.parse(await sc.browser.getSelectorContent("#p0f").catch(() => undefined) ?? "{}")
    const fp: FP = JSON.parse(await sc.browser.getSelectorContent("#fp").catch(() => undefined) ?? "{}")

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
      fp.navigatorProperties.join(",") === domDefaults.navigatorProperties.join(",") ? undefined : `fp.navigatorProperties = MISMATCH (vs the expected items in ${ULIXEE_URL_BY_OS_AND_BROWSER[os.type()]!})`,
    ]

    // logGlobal(problems.filter(p => p !== undefined))
    // logGlobal("waiting")
    // await sc.pause()
    // debugger

    return problems.filter(p => p !== undefined)
  }, { name: "incolumitas", defaultTimeout: 60_000, useGlobalCache: false }, "incolumitas")

  return problems
}

//////////////////////////

logGlobal("running Incolumnitas (https://bot.incolumitas.com/)...")
logGlobal((await runIncolumnitas()).result)
logGlobal("done")
logger.close()
