// TODO: stop using setTimeout manually and switch to a lib like p-timeout so cancelations are considered
/* eslint-disable no-restricted-globals */

import type { BrowserContext, ElementHandle, HTTPResponse, Page, PuppeteerLifeCycleEvent } from "puppeteer"
import type { FlightWithFares, ScraperQuery, ScraperResponse } from "../types/scrapers"

// WARNING: replaced by the compiler (see src/helpers/runScraper.ts)
const FIREBASE_SCRAPER_RUNS_URL_WITH_KEY = ""
const FIREBASE_UID = "unknown"

export type ScraperFlowRule = {
  find: string
  type?: string
  selectValue?: string
  done?: true
  returnInnerText?: boolean
  andWaitFor?: string
  andDebugger?: true
  andThen?: ScraperFlowRule[]
  reusable?: boolean
  throw?: string   // an error will be thrown with this text
  clickMethod?: "default" | "offset55" | "eval" | "dont-click"    // offset55 = clicks at (5,5) from the top of the button, eval = uses element.evaluate and does an element.click()
  andContainsText?: string
}

type StartScraperOptions = {
  blockInUrl?: string[]
}

export type ScraperMetadata = {
  name: string,
  blockUrls?: string[]
  noRandomUserAgent?: boolean
  noBlocking?: boolean
}

export type Scraper = (page: Page, query: ScraperQuery) => Promise<FlightWithFares[]>
export type BrowserlessInput = { page: Page, context: ScraperQuery, browser?: any, timeout?: number }
type BrowserlessOutput = { data: ScraperResponse, type: "application/json", headers: Record<string, string | number> }

let currentMeta: ScraperMetadata
const logLines: string[] = []
export const browserlessInit = async (meta: ScraperMetadata, scraper: Scraper, input: BrowserlessInput): Promise<BrowserlessOutput> => {
  currentMeta = meta
  const scraperStartTime = Date.now()
  log(`*** Starting scraper with ${JSON.stringify(input.context)}}`)

  await prepPage(input.page, meta)

  let timeoutTimer: NodeJS.Timeout | undefined
  const timeout = new Promise<undefined>((resolve) => {
    timeoutTimer = setTimeout(async () => {
      log("* Master scraper timeout")
      return resolve(undefined)
    }, (input.timeout ?? 30000) - 3000)  // -3.0s for AWS to not cut off the request
    // TODO: need to do request timeout, this timeout is just too short sometimes
  })

  let result = await Promise.race([runAttempt(input.page, input, scraper, meta, undefined), timeout])
  const errored = result === undefined
  if (result === undefined) {
    log("* Ended in an error, getting screenshot *")
    await screenshot(input.page).catch(() => {})
    result = []
  }

  if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
  await input.browser?.close().catch(() => {})

  log(`*** Completed scraper ${ errored ? "with error " : ""}after ${Math.round(Date.now() - scraperStartTime) / 1000} seconds with ${result.length} result(s)`)

  // eslint-disable-next-line no-unused-vars
  const fetch = require("node-fetch") // available from browserless
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (FIREBASE_SCRAPER_RUNS_URL_WITH_KEY !== "" && FIREBASE_UID !== "unknown") {
    void fetch(`${FIREBASE_SCRAPER_RUNS_URL_WITH_KEY}&documentId=run-${Date.now()}`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          scraper_name: { stringValue: meta.name },
          search_origin: { stringValue: input.context.origin },
          search_destination: { stringValue: input.context.destination },
          search_departure_date: { stringValue: input.context.departureDate },
          start_unix: { integerValue: scraperStartTime },
          duration_ms: { integerValue: Date.now() - scraperStartTime },
          status: { stringValue: errored ? "failure" : "success" },
          results: { stringValue: JSON.stringify(result) },
          log: { stringValue: logLines.join("\n") },
          uid: { stringValue: FIREBASE_UID }
        }
      })
    })
  }

  return {
    data: { flightsWithFares: result, errored, log: logLines },
    type: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  }
}

const screenshot = async (page: Page) => {
  const path = `/tmp/${currentMeta.name}-${Date.now()}.png`
  await page.screenshot({ path })
  log(`* Screenshot saved to ${path} *`)
}

export const prepPage = async (pageToPrep: Page, meta: ScraperMetadata) => {
  if (!meta.noBlocking) await applyPageBlocks(pageToPrep, { blockInUrl: meta.blockUrls })
  if (!meta.noRandomUserAgent) await pageToPrep.setUserAgent(randomUserAgent())

  // pageToPrep.on("response", (res) => {
  //   if (res.url().startsWith("data:")) return
  //   log(`url coming in ${res.fromCache() ? "CACHED" : "uncached"}: ${res.url()}`)
  // })
  await pageToPrep.setBypassCSP(true)
}

const runAttempt = async (page: Page, input: BrowserlessInput, scraper: Scraper, meta: ScraperMetadata, contextToClose: BrowserContext | undefined): Promise<FlightWithFares[] | undefined> => {
  const result = await scraper(page, input.context).catch(async (error) => {
    if (page.isClosed()) return undefined
    log("* Error in scraper, taking screenshot *\n", error)
    await screenshot(page)
    return undefined
  })

  await page.close().catch((error) => {})
  if (contextToClose) await contextToClose.close().catch((error) => {})

  return result
}

const randId = Math.round(Math.random() * 1000)
export const log = (...toLog: any) => {
  const start = `[${(new Date()).toLocaleString()} ${currentMeta.name}-${randId}]`
  logLines.push([start, ...toLog].map((line) => ((typeof line === "string") ? line : JSON.stringify(line))).join(" "))
  console.log(start, ...toLog)
}

export const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) })

export const gotoPage = async (page: Page, url: string, waitUntil: PuppeteerLifeCycleEvent = "domcontentloaded", timeout: number = waitUntil === "domcontentloaded" ? 5000 : 25000) => {
  log(`Going to ${url}`)
  const load = await page.goto(url, { waitUntil, timeout })
  if (load && load.status() !== 200) {
    log(await load.text())
    throw new Error(`Page loading failed with status ${load.status()}`)
  }

  log("Completed loading url")
  return load
}

// Goes to a URL with a bunch of conveniences
//   - It will make the request and a child response can come in before the main request is completed
//   - Responses coming in throughout the request will reset the gap timeout
//   - If the gap timeout happens or the expected child response doesn't happen, an error is thrown (and the entire scraper will be retried)
//   - If the page is closed, everything ends gracefully
type WaitForResponse = string | ((response: HTTPResponse) => boolean | Promise<boolean>)
type GotoPageOptions = { page: Page, url: string, maxResponseGapMs?: number, waitForResponse: WaitForResponse, waitUntil?: PuppeteerLifeCycleEvent, waitMoreWhen?: string[], waitMax?: boolean }
export const gotoPageAndWaitForResponse = async ({ url, page, maxResponseGapMs = 7000, waitForResponse, waitMoreWhen = [], waitMax = false }: GotoPageOptions) => {
  let gapTimeoutTimer: number = -1
  let completed = false

  log(`going to url: ${url}`)
  void page.goto(url, { timeout: 0 }).then((resp) => { // TODO: waituntil isnt used here, should it be?
    log("parent url finished loading")
    return resp ?? undefined

  }).catch((error) => {
    if (page.isClosed()) return
    if (completed) return "already completed"    // the request had already finished
    log(`parent url error: ${error}`)
    return (error as Error).message
  })

  // Gap timeout timer
  let gapTimeoutFunction: TimerHandler
  const gapTimeoutProm = new Promise<string>((resolve) => {
    gapTimeoutFunction = () => { resolve("gap timeout") }
    gapTimeoutTimer = setTimeout(gapTimeoutFunction, maxResponseGapMs)
  })

  let waitMore = false
  const responseProm = page.waitForResponse((response: HTTPResponse) => {
    // If this callback happens after the request is done, ignore it
    if (completed) return true

    // Reset the gap timeout timer since we got a response
    clearTimeout(gapTimeoutTimer)
    if (waitMoreWhen.some((checkUrl) => response.url().includes(checkUrl))) {
      if (!waitMore) log("enabled waitextra!")
      waitMore = true
    }
    gapTimeoutTimer = !waitMax ? setTimeout(gapTimeoutFunction, maxResponseGapMs + (waitMore ? 29000 - maxResponseGapMs : 0)) : -1
    // gapTimeoutTimer = setTimeout(resolveFunc, waitMore ? 29000 : maxResponseGapMs)) // <<<< better luck
    // TODO: we really need async requests so we can take longer than 30s to fulfill some requests

    if (typeof waitForResponse === "string") return response.url() === waitForResponse
    return waitForResponse!(response)
  }, { timeout: 0 })

  // Either we get a response or a timeout
  const responseOrTimeout = await Promise.race([responseProm, gapTimeoutProm])

  // Ensure that events don't happen after we're completed
  completed = true
  if (gapTimeoutTimer !== -1) clearTimeout(gapTimeoutTimer)

  // Timeouts resolve as strings
  if (typeof responseOrTimeout === "string") throw new Error(responseOrTimeout)

  // Early catch errors
  if (responseOrTimeout.status() !== 200) throw new Error(`Got status ${responseOrTimeout.status()}`)

  return responseOrTimeout
}

export const waitFor = async function waitFor(f: () => boolean) {
  while (!f())
    // eslint-disable-next-line no-await-in-loop
    await sleep(200)
  return f()
}

export const retry = async <T>(maxAttempts: number, toRetry: () => Promise<T>): Promise<T> => {
  const execute = async (attempt: number): Promise<T> => {
    try {
      return await toRetry()
    } catch (error) {
      if ((error as Error).message === "max timeout") {
        log("Bailing out of retry because of max timeout")
        throw error
      }
      log(`Failed attempt (${(error as Error).message}). ${attempt >= maxAttempts ? "Giving up" : "Will retry in 1s"}.`)
      if (attempt >= maxAttempts)
        throw error

      await sleep(1000)
      return execute(attempt + 1)
    }
  }
  return execute(1)
}

export const applyPageBlocks = async (page: Page, options?: StartScraperOptions) => {
  const blockedResources = [
    "*/favicon.ico", ".css", ".jpg", ".jpeg", ".png", ".svg", ".woff",
    "*.optimizely.com", "everesttech.net", "userzoom.com", "doubleclick.net", "googleadservices.com", "adservice.google.com/*",
    "connect.facebook.com", "connect.facebook.net", "sp.analytics.yahoo.com",
    "cdn.cookielaw.org", "*.qualtrics.com", "p11.techlab-cdn.com",
    ...(options?.blockInUrl ?? []),
  ]
  // Use existing CDP connection from Puppeteer (puppeteer >= 14.4.1: page._client -> page._client())
  // @ts-expect-error
  // eslint-disable-next-line no-underscore-dangle
  const client = typeof page._client === "function" ? page._client() : page._client
  await client.send("Network.setBlockedURLs", { urls: blockedResources })
}

export const processScraperFlowRules = async (page: Page, rules: ScraperFlowRule[], withDelays: boolean = false): Promise<string> => {
  const skipIndexes: number[] = []

  const matchNextRule = async () => {
    if (skipIndexes.length === rules.length)
      return
    const matchAll = async () => {
      const startTime = Date.now()

      while (Date.now() - startTime < 10000) {
        for (const [ruleIndex, rule] of rules.entries()) {
          if (skipIndexes.includes(ruleIndex))
            continue
          let element: ElementHandle | undefined
          try {
            element = await page.$(rule.find) ?? undefined
          } catch {
            // ignore error
          }

          if (!element)
            continue
          return { index: ruleIndex, element }
        }
        await sleep(100)
      }
      return
    }
    const match = await matchAll()
    if (!match)
      return
    if (!rules[match.index].reusable)
      skipIndexes.push(match.index)
    return { element: match.element!, rule: rules[match.index] }
  }

  let matchedRule = await matchNextRule()
  while (matchedRule) {
    if (withDelays) await sleep(75 + (Math.random() * 50))

    if (matchedRule.rule.andContainsText) {
      const text = await matchedRule.element.evaluate((matchedElement) => matchedElement.textContent)
      if (!text?.includes(matchedRule.rule.andContainsText)) {
        matchedRule = await matchNextRule()
        continue
      } else {
        log("matched text", text)
      }
    } else {
      log("matched rule", matchedRule.rule.find)
    }

    // Do not click on the element in certain cases
    if (!matchedRule.rule.selectValue) {
      if (matchedRule.rule.clickMethod === "offset55") {
        await matchedRule.element.click({ offset: { x: 5, y: 5 }, delay: withDelays ? 50 + (Math.random() * 100) : 0 })
      } else if (matchedRule.rule.clickMethod === "eval") {
        await matchedRule.element.evaluate((matchedElement: any) => matchedElement.click())
      } else if (matchedRule.rule.clickMethod === "dont-click") {
        // do nothing
      } else {
        await matchedRule.element.click({ delay: withDelays ? 50 + (Math.random() * 100) : 0 })
      }
    }

    if (matchedRule.rule.andDebugger)
      debugger

    if (matchedRule.rule.type) {
      await matchedRule.element.focus()
      await sleep(10)
      await page.keyboard.type(matchedRule.rule.type, { delay: withDelays ? 300 + (Math.random() * 100) : undefined })
    }

    if (matchedRule.rule.selectValue) {
      await page.select(matchedRule.rule.find, matchedRule.rule.selectValue)
    }

    if (matchedRule.rule.andWaitFor) {
      log(`waiting for ${matchedRule.rule.andWaitFor}`)
      await page.waitForSelector(matchedRule.rule.andWaitFor)
      log("got it")
    }

    if (matchedRule.rule.andThen)
      await processScraperFlowRules(page, matchedRule.rule.andThen)

    if (matchedRule.rule.done)
      return matchedRule.rule.find

    if (matchedRule.rule.throw)
      throw new Error(matchedRule.rule.throw)

    matchedRule = await matchNextRule()
  }

  return ""
}

export const pptrFetch = async (page: Page, url: string, init: RequestInit, timeoutMs: number = 25000) => {
  // eslint-disable-next-line no-shadow
  return page.evaluate(async (url, init, timeoutMs) => {
    const ac = new AbortController()
    const { signal } = ac
    void setTimeout(() => { ac.abort() }, timeoutMs)

    const fetchResponse = await fetch(url, { ...init, signal })
    return fetchResponse.text()
  }, url, init, timeoutMs)
}

export const equipmentTypeLookup: Record<string, string> = {
  "717": "Boeing 717-200",
  "733": "Boeing 737-300",
  "735": "Boeing 737-500",
  "738": "Boeing 737-800",
  "7M7": "Boeing 737 MAX7",
  "7M8": "Boeing 737 MAX8",
  "73C": "Boeing 737-300",
  "73G": "Boeing 737-700",
  "73H": "Boeing 737-800",
  "73R": "Boeing 737-700",
  "7T7": "Boeing 737 MAX7",
  "73W": "Boeing 737-700",
  "7T8": "Boeing 737 MAX8"
}

export const randomUserAgent = () => {
  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.116 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36 Edg/86.0.622.63",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.20 Safari/537.36 Edg/87.0.664.12",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36 Edg/87.0.664.55",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.57",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.146 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.63",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.75 Safari/537.36 Google Favicon",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36",
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

export {}
