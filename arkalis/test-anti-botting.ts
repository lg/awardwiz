// This file is run directly. Example:
//   docker run -it --rm awardwiz:scrapers node dist/arkalis/test-anti-botting.js

/* eslint-disable no-console */
import { DebugOptions, runArkalis } from "./arkalis.js"
import os from "node:os"
import pako from "pako"
import fetch from "cross-fetch"
import * as dotenv from "dotenv"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"
dayjs.extend(utc)
dayjs.extend(timezone)
dotenv.config()

const debugOptions: DebugOptions = {
  maxAttempts: 5,
  pauseAfterRun: false,
  pauseAfterError: true,
  useProxy: false,
  timezone: "America/Los_Angeles",
  showRequests: false,
}

//////////////////////////

const ULIXEE_URL_BY_OS_AND_BROWSER: Record<string, string> = {
  "Windows NT": "windows-11--chrome-110-0",
  "Linux": "windows-11--chrome-110-0",
  "Darwin": "mac-os-13--chrome-110-0",
}

const getDomDefaults = async (osType: string) => {
  const osAndBrowser = ULIXEE_URL_BY_OS_AND_BROWSER[osType]!
  const url = `https://github.com/ulixee/browser-profile-data/raw/main/profiles/${osAndBrowser}/browser-dom-environment--https.json.gz`
  const gzippedResponse = await fetch(url)
  const buffer = await gzippedResponse.arrayBuffer()
  const text = new TextDecoder("utf-8").decode(pako.inflate(buffer))
  const raw = JSON.parse(text) as { data: { window: { Navigator?: { prototype: Record<string, unknown> } } } }

  const navigatorProperties = [
    ...Object.keys(raw.data.window.Navigator?.prototype ?? {}).filter(check => !["_$protos", "Symbol(Symbol.toStringTag)", "_$type", "_$flags"].includes(check)),
    "constructor", "toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
    "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__", "__proto__", "constructor"
  ]

  return { navigatorProperties, raw }
}

console.log(`downloading dom defaults for ${os.type()}`)
const domDefaults = await getDomDefaults(os.type())

const runIncolumnitas = async () => {
  const problems = await runArkalis(async (arkalis) => {
    arkalis.goto("https://bot.incolumitas.com/")

    arkalis.log("waiting for tests to finish")
    await arkalis.waitFor({ "fingerprint": { type: "html", html: /"fpscanner": \{\n/gu } })

    const newTests = JSON.parse(await arkalis.getSelectorContent("#new-tests") ?? "{}") as NewDetectionTests
    const oldTestsIntoli = (JSON.parse(await arkalis.getSelectorContent("#detection-tests") ?? "{}") as OldTests).intoli
    const oldTestsFpscanner = (JSON.parse(await arkalis.getSelectorContent("#detection-tests") ?? "{}") as OldTests).fpscanner
    const datacenter = JSON.parse(await arkalis.getSelectorContent("#datacenter-ip-api-data").catch(() => undefined) ?? "{}") as DatacenterIpCheck
    const datacenterOffset = -dayjs().utcOffset(datacenter.location.timezone).utcOffset() // ex 480
    //const tcpipFingerprint = JSON.parse(await arkalis.getSelectorContent("#p0f").catch(() => undefined) ?? "{}") as TcpIpFingerprint
    const fp = JSON.parse(await arkalis.getSelectorContent("#fp").catch(() => undefined) ?? "{}") as FP

    /* eslint-disable @typescript-eslint/restrict-template-expressions */
    const problems = [
      ...Object.entries(newTests).filter(([k, v]) => v === "FAIL").map(([k, v]) => `new-tests.${k} = ${v}`),
      ...Object.entries(oldTestsIntoli).filter(([k, v]) => v === "FAIL").map(([k, v]) => `intoli.${k} = ${v}`),
      ...Object.entries(oldTestsFpscanner).filter(([k, v]) => v === "FAIL").map(([k, v]) => `fpscanner.${k} = ${v}`),
      ...["is_bogon", "is_datacenter", "is_tor", "is_proxy", "is_vpn", "is_abuser"].map(k => datacenter[k as keyof DatacenterIpCheck] === false ? undefined : `datacenter.${k} = ${datacenter[k as keyof DatacenterIpCheck] as string}`),
      datacenter.asn.type !== "isp" ? `datacenter.asn.type = ${datacenter.asn.type} (not "isp")` : undefined,
      //tcpipFingerprint.os_mismatch ? `tcpip-fingerprint.os_mismatch = ${tcpipFingerprint.os_mismatch}` : undefined,
      fp.webDriver ? undefined : `fp.webDriver = ${fp.webDriver} (was expecting true)`,
      fp.webDriverValue ? `fp.webDriverValue = ${fp.webDriverValue} (was expecting false/undefined)` : undefined,
      fp.selenium.some((item) => item) ? `fp.selenium = ${fp.selenium}` : undefined,
      fp.phantomJS.some((item) => item) ? `fp.phantomJS = ${fp.phantomJS}` : undefined,
      fp.nightmareJS ? `fp.nightmareJS = ${fp.nightmareJS}` : undefined,
      fp.domAutomation ? `fp.domAutomation = ${fp.domAutomation}` : undefined,
      fp.debugTool ? `fp.debugTool = ${fp.debugTool}` : undefined,
      fp.getTimezoneOffset !== datacenterOffset ? `fp.getTimezoneOffset = ${fp.getTimezoneOffset} (was expecting ${datacenterOffset} as per ip from fp)` : undefined,
      fp.navigatorProperties.join(",") === domDefaults.navigatorProperties.join(",") ? undefined : `fp.navigatorProperties = MISMATCH (vs the expected items in ${ULIXEE_URL_BY_OS_AND_BROWSER[os.type()]!})`,
    ]
    /* eslint-enable @typescript-eslint/restrict-template-expressions */

    // These tests are being done innacurately on incolumitas
    problems[problems.indexOf("fpscanner.WEBDRIVER = FAIL")] = undefined    // fails on real Chrome too

    // arkalis.log(problems.filter(p => p !== undefined))
    // await arkalis.pause()

    return problems.filter(p => p !== undefined)
  }, debugOptions, { name: "incolumitas", defaultTimeoutMs: 60_000, useGlobalBrowserCache: false }, "incolumitas")

  return problems
}

const runSannysoft = async () => {
  const problems = await runArkalis(async (arkalis) => {
    arkalis.goto("https://bot.sannysoft.com/")

    arkalis.log("waiting for tests to finish")
    await arkalis.waitFor({ "completed": { type: "html", html: /PHANTOM_WINDOW_HEIGHT/gu } })
    arkalis.log("checking results")

    const problems: (string | undefined)[] = [
      /* eslint-disable quotes */
      ...await arkalis.evaluate<string[]>(`failed = []; document.querySelectorAll("td[id][class='failed']").forEach((el) => failed.push(el.id)); failed`),
      ...await arkalis.evaluate<string[]>(`failed = []; document.querySelectorAll("td[class='failed']:not([id])").forEach((el) => failed.push(el.previousSibling.innerText)); failed`),
      ...await arkalis.evaluate<string[]>(`failed = []; document.querySelectorAll("td[class='warn']:not([id])").forEach((el) => failed.push(el.previousSibling.innerText)); failed`)
      /* eslint-enable quotes */
    ].filter(problem => problem !== "null").map(item => `sannysoft.${item} = FAIL`)

    // These tests are being done innacurately on sannysoft
    problems[problems.indexOf("sannysoft.WEBDRIVER = FAIL")] = undefined    // fails on real Chrome too

    // arkalis.log(problems.filter(p => p !== undefined))
    // await arkalis.pause()

    return problems.filter(p => p !== undefined)
  }, debugOptions, { name: "sannysoft", defaultTimeoutMs: 60_000, useGlobalBrowserCache: false }, "sannysoft")

  return problems
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const runCreepJSWIP = async () => {
  const problems = await runArkalis(async (arkalis) => {
    arkalis.goto("https://abrahamjuliot.github.io/creepjs/")

    arkalis.log("waiting for tests to finish")
    await arkalis.waitFor({ "completed": { type: "html", html: /performance benchmark/gu } })
    arkalis.log("checking results")

    await arkalis.pause()

    return []
  }, debugOptions, { name: "creepjs", defaultTimeoutMs: 60_000, useGlobalBrowserCache: false }, "creepjs")

  return problems
}

//////////////////////////

console.log("running Incolumnitas (https://bot.incolumitas.com/)...")
console.log((await runIncolumnitas()).result)
console.log("running Sannysoft (https://bot.sannysoft.com/)...")
console.log((await runSannysoft()).result)
// console.log("running CreepJS (https://abrahamjuliot.github.io/creepjs/)...")
// console.log((await runCreepJSWIP()).result)
console.log("done")


//////////////////////////
/* eslint-disable @typescript-eslint/no-unused-vars */

// types for the bot tests
// used https://transform.tools/json-to-typescript for this

type FP = {
  byteLength: string;
  appVersion: string;
  onLine: boolean;
  doNotTrack: string;
  hardwareConcurrency: number;
  oscpu: string;
  timezone: number;
  timezone2: string;
  systemTime: string;
  getTimezoneOffset: number;
  toLocaleString: string;
  historyLength: number;
  indexedDB: boolean;
  openDatabase: boolean;
  product: string;
  fmget: boolean;
  domAutomation: boolean;
  cookieEnabled: boolean;
  sendBeaconAvailable: boolean;
  appName: string;
  vendor: string;
  appCodeName: string;
  userMediaAvailable: boolean;
  javaEnabled: boolean;
  batteryDetails: {
    error: boolean;
    message: string;
  };
  plugins: string[];
  mimeTypes: string[];
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  screen: {
    wInnerHeight: number;
    wOuterHeight: number;
    wOuterWidth: number;
    wInnerWidth: number;
    wScreenX: number;
    wPageXOffset: number;
    wPageYOffset: number;
    cWidth: number;
    cHeight: number;
    sWidth: number;
    sHeight: number;
    sAvailWidth: number;
    sAvailHeight: number;
    sColorDepth: number;
    sPixelDepth: number;
    wDevicePixelRatio: number;
  };
  touchScreen: number[];
  videoCard: string[];
  multimediaDevices: {
    speakers: number;
    micros: number;
    webcams: number;
  };
  productSub: string;
  navigatorPrototype: string[];
  navigatorProperties: string[];
  etsl: number;
  screenDesc: string;
  phantomJS: boolean[];
  nightmareJS: boolean;
  selenium: boolean[];
  webDriver: boolean;
  webDriverValue: boolean;
  errorsGenerated: (string | number | null)[];
  resOverflow: {
    depth: number;
    errorMessage: string;
    errorName: string;
    errorStacklength: number;
  };
  accelerometerUsed: boolean;
  screenMediaQuery: boolean;
  hasChrome: boolean;
  detailChrome: string;
  permissions: {
    state: string;
    permission: string;
  };
  allPermissions: Record<
    string,
    { state: string; permission: string } | { error: string }
  >;
  iframeChrome: string;
  debugTool: boolean;
  battery: boolean;
  deviceMemory: number;
  tpCanvas: Record<string, number>;
  sequentum: boolean;
  audioCodecs: Record<string, string>;
  videoCodecs: Record<string, string>;
  webSocketSupportTimeout: boolean;
};

//////////////////

type TLSFingerprint = {
  num_fingerprints: number;
  sha3_384: string;
  tls_fp: {
    ciphers: string;
    client_hello_version: string;
    ec_point_formats: string;
    extensions: string;
    record_version: string;
    signature_algorithms: string;
    supported_groups: string;
  };
  "user-agent": string;
  utc_now: string;
};

//////////////////

interface TcpIpFingerprint {
  avg_score_os_class: {
    Android: number
    Linux: number
    "Mac OS": number
    Windows: number
    iOS: number
  }
  lookup_ip: string
  os_mismatch: boolean
  perfect_score: number
}

//////////////////

type DatacenterIpCheck = {
  ip: string
  rir: string
  is_bogon: boolean
  is_datacenter: boolean
  is_tor: boolean
  is_proxy: boolean
  is_vpn: boolean
  is_abuser: boolean
  company: {
    name: string
    domain: string
    network: string
    whois: string
  }
  asn: {
    asn: number
    route: string
    descr: string
    country: string
    active: boolean
    org: string
    domain: string
    abuse: string
    type: string
    created: string
    updated: string
    rir: string
    whois: string
  }
  location: {
    country: string
    state: string
    city: string
    latitude: string
    longitude: string
    zip: string
    timezone: string
    local_time: string
    local_time_unix: number
  }
  elapsed_ms: number
}

//////////////////

type OkUnknownFail = "OK" | "UNKNOWN" | "FAIL";
type OldTests = {
  intoli: {
    userAgent: OkUnknownFail
    webDriver: OkUnknownFail
    webDriverAdvanced: OkUnknownFail
    pluginsLength: OkUnknownFail
    pluginArray: OkUnknownFail
    languages: OkUnknownFail
  }
  fpscanner: {
    PHANTOM_UA: OkUnknownFail
    PHANTOM_PROPERTIES: OkUnknownFail
    PHANTOM_ETSL: OkUnknownFail
    PHANTOM_LANGUAGE: OkUnknownFail
    PHANTOM_WEBSOCKET: OkUnknownFail
    MQ_SCREEN: OkUnknownFail
    PHANTOM_OVERFLOW: OkUnknownFail
    PHANTOM_WINDOW_HEIGHT: OkUnknownFail
    HEADCHR_UA: OkUnknownFail
    WEBDRIVER: OkUnknownFail
    HEADCHR_CHROME_OBJ: OkUnknownFail
    HEADCHR_PERMISSIONS: OkUnknownFail
    HEADCHR_PLUGINS: OkUnknownFail
    HEADCHR_IFRAME: OkUnknownFail
    CHR_DEBUG_TOOLS: OkUnknownFail
    SELENIUM_DRIVER: OkUnknownFail
    CHR_BATTERY: OkUnknownFail
    CHR_MEMORY: OkUnknownFail
    TRANSPARENT_PIXEL: OkUnknownFail
    SEQUENTUM: OkUnknownFail
    VIDEO_CODECS: OkUnknownFail
  }
}

//////////////////

type NewDetectionTests = {
  puppeteerEvaluationScript: OkUnknownFail
  webdriverPresent: OkUnknownFail
  connectionRTT: OkUnknownFail
  puppeteerExtraStealthUsed: OkUnknownFail
  inconsistentWebWorkerNavigatorPropery: OkUnknownFail
}
