import { logger, logGlobal } from "./log.js"
import { DebugOptions, Arkalis } from "./arkalis.js"
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
  timezone: "America/Los_Angeles",
  showRequests: false,
  log: (prettyLine: string, id: string) => logger.info(prettyLine, { id }),
  winston: logger,
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
  const problems = await Arkalis.run(async (arkalis) => {
    arkalis.goto("https://bot.incolumitas.com/")

    arkalis.log("waiting for tests to finish")
    await arkalis.waitFor({ "fingerprint": { type: "html", html: /"fpscanner": \{\n/gu } })

    const newTests: NewDetectionTests = JSON.parse(await arkalis.getSelectorContent("#new-tests") ?? "{}")
    const oldTestsIntoli: OldTests["intoli"] = JSON.parse(await arkalis.getSelectorContent("#detection-tests") ?? "{}").intoli
    const oldTestsFpscanner: OldTests["fpscanner"] = JSON.parse(await arkalis.getSelectorContent("#detection-tests") ?? "{}").fpscanner
    const datacenter: DatacenterIpCheck = JSON.parse(await arkalis.getSelectorContent("#datacenter-ip-api-data").catch(() => undefined) ?? "{}")
    const tcpipFingerprint: TcpIpFingerprint = JSON.parse(await arkalis.getSelectorContent("#p0f").catch(() => undefined) ?? "{}")
    const fp: FP = JSON.parse(await arkalis.getSelectorContent("#fp").catch(() => undefined) ?? "{}")

    const problems = [
      ...Object.entries(newTests).filter(([k, v]) => v === "FAIL").map(([k, v]) => `new-tests.${k} = ${v}`),
      ...Object.entries(oldTestsIntoli).filter(([k, v]) => v === "FAIL").map(([k, v]) => `intoli.${k} = ${v}`),
      ...Object.entries(oldTestsFpscanner).filter(([k, v]) => v === "FAIL").map(([k, v]) => `fpscanner.${k} = ${v}`),
      ...["is_bogon", "is_datacenter", "is_tor", "is_proxy", "is_vpn", "is_abuser"].map(k => datacenter[k as keyof DatacenterIpCheck] === false ? undefined : `datacenter.${k} = ${datacenter[k as keyof DatacenterIpCheck] as string}`),
      datacenter.asn.type !== "isp" ? `datacenter.asn.type = ${datacenter.asn.type} (not "isp")` : undefined,
      tcpipFingerprint.os_mismatch ? `tcpip-fingerprint.os_mismatch = ${tcpipFingerprint.os_mismatch}` : undefined,
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
    // await sc.pause()

    return problems.filter(p => p !== undefined)
  }, debugOptions, { name: "incolumitas", defaultTimeout: 60_000, useGlobalCache: false }, "incolumitas")

  return problems
}

const runSannysoft = async () => {
  const problems = await Arkalis.run(async (arkalis) => {
    arkalis.goto("https://bot.sannysoft.com/")

    arkalis.log("waiting for tests to finish")
    await arkalis.waitFor({ "completed": { type: "html", html: /PHANTOM_WINDOW_HEIGHT/gu } })
    arkalis.log("checking results")

    const items = [
      /* eslint-disable quotes */
      ...await arkalis.evaluate<string[]>(`failed = []; document.querySelectorAll("td[id][class='failed']").forEach((el) => failed.push(el.id)); failed`),
      ...await arkalis.evaluate<string[]>(`failed = []; document.querySelectorAll("td[class='failed']:not([id])").forEach((el) => failed.push(el.previousSibling.innerText)); failed`),
      ...await arkalis.evaluate<string[]>(`failed = []; document.querySelectorAll("td[class='warn']:not([id])").forEach((el) => failed.push(el.previousSibling.innerText)); failed`)
      /* eslint-enable quotes */
    ].filter(item => item !== "null").map(item => `sannysoft.${item} = FAIL`)

    // logGlobal(items)
    // await sc.pause()

    return items
    //return items.filter(item => item !== undefined)
  }, debugOptions, { name: "sannysoft", defaultTimeout: 60_000, useGlobalCache: false }, "sannysoft")

  return problems
}

// eslint-disable-next-line no-unused-vars
const runCreepJSWIP = async () => {
  const problems = await Arkalis.run(async (arkalis) => {
    arkalis.goto("https://abrahamjuliot.github.io/creepjs/")

    arkalis.log("waiting for tests to finish")
    await arkalis.waitFor({ "completed": { type: "html", html: /performance benchmark/gu } })
    arkalis.log("checking results")

    await arkalis.pause()

    return []
  }, debugOptions, { name: "creepjs", defaultTimeout: 60_000, useGlobalCache: false }, "creepjs")

  return problems
}

//////////////////////////

logGlobal("running Incolumnitas (https://bot.incolumitas.com/)...")
logGlobal((await runIncolumnitas()).result)
logGlobal("running Sannysoft (https://bot.sannysoft.com/)...")
logGlobal((await runSannysoft()).result)
// logGlobal("running CreepJS (https://abrahamjuliot.github.io/creepjs/)...")
// logGlobal((await runCreepJSWIP()).result)
logGlobal("done")

logger.close()
