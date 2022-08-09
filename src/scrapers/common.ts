/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import type { ElementHandle, HTTPResponse, Page, PuppeteerLifeCycleEvent } from "puppeteer"
import type { FlightWithFares, ScraperQuery } from "../types/scrapers"

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
  clickMethod?: "default" | "offset55" | "eval"    // offset55 = clicks at (5,5) from the top of the button, eval = uses element.evaluate and does an element.click()
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
type BrowserlessInput = { page: Page, context: any, browser?: any, timeout?: number }

let curMeta: ScraperMetadata
export const browserlessInit = async (meta: ScraperMetadata, scraperFunc: Scraper, params: BrowserlessInput) => {
  curMeta = meta
  const scraperStartTime = Date.now()
  log(`*** Starting scraper with ${JSON.stringify(params.context)}}`)

  if (!meta.noBlocking) await applyPageBlocks(params.page, { blockInUrl: meta.blockUrls })
  if (!meta.noRandomUserAgent) await params.page.setUserAgent(randomUserAgent())

  const result = await scraperFunc(params.page, params.context).catch((e) => {
    log("** Uncaught Error in scraper **\n", e)
    throw e
  })

  await params.page.close().catch((err) => {})
  await params.browser.close().catch(() => {})

  log(`*** Completed scraper after ${Math.round(Date.now() - scraperStartTime) / 1000} seconds with ${result.length} result(s)`)
  return { data: { flightsWithFares: result } }
}

export const log = (...args: any) => console.log(`[${(new Date()).toLocaleString()} ${curMeta.name}] `, ...args)

export const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) })

// Goes to a URL with a bunch of conveniences
//   - It will make the request and a child response can come in before the main request is completed
//   - Responses coming in throughout the request will reset the gap timeout
//   - An expected response will stop the parent request
//   - If the gap timeout happens or the expected child response doesn't happen, the parent request is aborted and retried
//   - If the page is closed, everything ends gracefully *** TODO: this is not implemented yet ***
type WaitForResponse = string | ((res: HTTPResponse) => boolean | Promise<boolean>)
type GotoUrlOptions = { page: Page, url: string, retries?: number, maxResponseGapMs?: number, maxTimeoutMs?: number, waitForResponse?: WaitForResponse, waitUntil?: PuppeteerLifeCycleEvent }
export const gotoUrl = async ({ maxTimeoutMs = 25000, retries = 5, ...opts }: GotoUrlOptions) => {
  const startTime = Date.now()
  return retry(retries, async () => {
    return gotoUrlOnce({ ...opts, maxTimeoutMs: maxTimeoutMs - (Date.now() - startTime) })
  })
}

const gotoUrlOnce = async ({ url, page, waitUntil = "domcontentloaded", maxResponseGapMs = 5000, maxTimeoutMs, waitForResponse }: Omit<GotoUrlOptions, "retries">) => {
  let gapTimeoutTimer: number = -1
  let maxTimeoutTimer
  let completed = false

  const singleUrlMode = !waitForResponse

  // The global timeout (including all retries)
  const maxTimeoutProm = new Promise<string>((resolve) => {
    maxTimeoutTimer = setTimeout(() => resolve(singleUrlMode ? "gap timeout" : "max timeout"), singleUrlMode ? maxResponseGapMs : maxTimeoutMs)
  })

  log(`going to url: ${url}`)
  const urlProm = page.goto(url, { waitUntil, timeout: 0 }).then((resp) => {
    log("parent url finished loading")
    return resp ?? undefined
  }).catch((err) => {
    if (completed) return "already completed"    // the request had already finished
    log(`parent url error: ${err}`)
    return err.message
  })

  // There is a simple mode for this function where not specifying waitForResponse will just do a
  // request for the url waiting for the waitUntil event. This retains the retry ability above.
  if (singleUrlMode) {
    const response = await Promise.race([urlProm, maxTimeoutProm])
    if (response === undefined || typeof response === "string") throw new Error(response)

    clearTimeout(maxTimeoutTimer)
    // TODO: maybe the Abort call is required here

    return response as HTTPResponse
  }

  // Gap timeout timer
  let resolveFunc: TimerHandler
  const gapTimeoutProm = new Promise<string>((resolve) => {
    resolveFunc = () => { resolve("gap timeout") }
    gapTimeoutTimer = setTimeout(resolveFunc, maxResponseGapMs)
  })

  const responseProm = page.waitForResponse((res: HTTPResponse) => {
    // If this callback happens after the request is done, ignore it
    if (completed) return true
    // if (!res.url().startsWith("data:")) log(`url coming in: ${res.url()}`)

    // Reset the gap timeout timer since we got a response
    clearTimeout(gapTimeoutTimer)
    gapTimeoutTimer = setTimeout(resolveFunc, maxResponseGapMs)

    if (typeof waitForResponse === "string") return res.url() === waitForResponse
    return waitForResponse!(res)
  }, { timeout: 0 })

  // Either we get a response or a timeout
  const ret = await Promise.race([responseProm, gapTimeoutProm, maxTimeoutProm])

  // Ensure that events don't happen after we're completed
  completed = true
  if (gapTimeoutTimer !== -1) clearTimeout(gapTimeoutTimer)
  clearTimeout(maxTimeoutTimer)

  // Timeouts resolve as strings
  if (ret === "max timeout" || ret === "gap timeout") {
    // @ts-expect-error
    // eslint-disable-next-line no-underscore-dangle
    const client = typeof page._client === "function" ? page._client() : page._client
    await client.send("Page.stopLoading")

    throw new Error(ret)
  }
  return ret as HTTPResponse
}

export const waitFor = async function waitFor(f: () => boolean) {
  while (!f())
    // eslint-disable-next-line no-await-in-loop
    await sleep(200)
  return f()
}

export const retry = async <T>(maxAttempts: number, fn: () => Promise<T>): Promise<T> => {
  const execute = async (attempt: number): Promise<T> => {
    try {
      return await fn()
    } catch (err) {
      if ((err as Error).message === "max timeout") {
        log("Bailing out of retry because of max timeout")
        throw err
      }
      log(`Failed attempt (${(err as Error).message}). ${attempt >= maxAttempts ? "Giving up" : "Will retry in 1s"}.`)
      if (attempt >= maxAttempts)
        throw err

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

export const processScraperFlowRules = async (page: Page, rules: ScraperFlowRule[]): Promise<string> => {
  const skipIndexes: number[] = []

  const matchNextRule = async () => {
    if (skipIndexes.length === rules.length)
      return undefined
    const matchAll = async () => {
      const startTime = Date.now()

      while (Date.now() - startTime < 10000) {
        for (let i = 0; i < rules.length; i += 1) {
          if (skipIndexes.includes(i))
            continue
          let element: ElementHandle | null = null
          try {
            element = await page.$(rules[i].find)
          } catch (e) {
            // ignore error
          }

          if (!element)
            continue
          return { index: i, element }
        }
        await sleep(100)
      }
      return undefined
    }
    const match = await matchAll()
    if (!match)
      return undefined
    if (!rules[match.index].reusable)
      skipIndexes.push(match.index)
    return { element: match.element!, rule: rules[match.index] }
  }

  let matchedRule = await matchNextRule()
  while (matchedRule) {
    log("matched rule", matchedRule.rule.find)
    //await sleep(400)

    // Do not click on the element in certain cases
    if (!matchedRule.rule.selectValue) {
      if (matchedRule.rule.clickMethod === "offset55") {
        await matchedRule.element.click({ offset: { x: 5, y: 5 } })
      } else if (matchedRule.rule.clickMethod === "eval") {
        await matchedRule.element.evaluate((el: any) => el.click())
      } else {
        await matchedRule.element.click()
      }
    }

    if (matchedRule.rule.andDebugger)
      debugger

    if (matchedRule.rule.type) {
      await matchedRule.element.focus()
      await page.waitForTimeout(10)
      await page.keyboard.type(matchedRule.rule.type)
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
    const resp = fetchResponse.text()
    return resp
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.146 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.116 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36 Edg/87.0.664.55",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.20 Safari/537.36 Edg/87.0.664.12",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.146 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36 Edg/86.0.622.63",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.75 Safari/537.36 Google Favicon",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.57",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.63",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36"
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

export {}
