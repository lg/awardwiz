import { Arkalis, ScraperMetadata } from "./arkalis.js"

export type ScraperResult<ReturnType> = {
  result: ReturnType | undefined
  logLines: string[]
}

export type AwardWizScraperModule = { meta: ScraperMetadata, runScraper: AwardWizScraper }
export type AwardWizScraper<ReturnType = FlightWithFares[]> = (req: Arkalis, query: AwardWizQuery) => Promise<ReturnType>
export type AwardWizQuery = { origin: string, destination: string, departureDate: string }

export type DatedRoute = { origin: string, destination: string, departureDate: string }

export type FlightWithFares = {
  flightNo: string                       // "UA 123"
  departureDateTime: string              // "2022-04-01 15:12"
  arrivalDateTime: string                // "2022-04-01 15:12"
  origin: string                         // "SFO"
  destination: string                    // "LHR"
  duration: number | undefined           // 62 (in minutes)
  aircraft: string | undefined           // "737"
  fares: FlightFare[]
  amenities: FlightAmenities
}

export type FlightFare = {
  cabin: string                           // "economy" | "business" | "first"
  miles: number
  cash: number                            // in dollars optionally with a decimal
  currencyOfCash: string
  scraper: string
  bookingClass: string | undefined        // (ex "I")

  isSaverFare?: boolean | undefined
}

export type FlightAmenities = {
  hasPods: boolean | undefined
  hasWiFi: boolean | undefined
}



////////////////////////////////////////////

// types for the bot tests

// used https://transform.tools/json-to-typescript for this

export type FP = {
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

export type TLSFingerprint = {
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

export interface TcpIpFingerprint {
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

export type DatacenterIpCheck = {
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

export type OkUnknownFail = "OK" | "UNKNOWN" | "FAIL";
export type OldTests = {
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

export type NewDetectionTests = {
  puppeteerEvaluationScript: OkUnknownFail
  webdriverPresent: OkUnknownFail
  connectionRTT: OkUnknownFail
  puppeteerExtraStealthUsed: OkUnknownFail
  inconsistentWebWorkerNavigatorPropery: OkUnknownFail
}
