/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import type { BrowserContext, ElementHandle, HTTPResponse, Page, PuppeteerLifeCycleEvent } from "puppeteer"
import type { FlightWithFares, ScraperQuery, ScraperResponse } from "../types/scrapers"

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
type BrowserlessInput = { page: Page, context: any, browser?: any, timeout?: number }

let curMeta: ScraperMetadata
export const browserlessInit = async (meta: ScraperMetadata, scraperFunc: Scraper, params: BrowserlessInput): Promise<{ data: ScraperResponse }> => {
  curMeta = meta
  const scraperStartTime = Date.now()
  log(`*** Starting scraper with ${JSON.stringify(params.context)}}`)

  await prepPage(params.page, meta)

  let timeoutTimer = -1
  const timeout = new Promise<undefined>((resolve) => {
    timeoutTimer = setTimeout(resolve, (params.timeout ?? 30000) - 1000)
  })

  let result = await Promise.race([runAttempt(params.page, params, scraperFunc, meta, undefined), timeout])
  const errored = result === undefined
  if (result === undefined) {
    log("* Ended in an error, getting screenshot *")
    const path = `${meta.name}-${Date.now()}.png`
    await params.page.screenshot({ path })
    log(`* Screenshot saved to ${process.cwd()}/${path} *`)
    result = []
  }

  if (timeoutTimer !== -1) clearTimeout(timeoutTimer)
  await params.browser?.close().catch(() => {})

  log(`*** Completed scraper after ${Math.round(Date.now() - scraperStartTime) / 1000} seconds with ${result.length} result(s) and ${retriesDone} retry(s)`)
  return { data: { flightsWithFares: result, errored, retries: retriesDone } }
}

const prepPage = async (pageToPrep: Page, meta: ScraperMetadata) => {
  if (!meta.noBlocking) await applyPageBlocks(pageToPrep, { blockInUrl: meta.blockUrls })
  if (!meta.noRandomUserAgent) await pageToPrep.setUserAgent(randomUserAgent())
}

let retriesDone = 0
const runAttempt = async (page: Page, params: BrowserlessInput, scraperFunc: Scraper, meta: ScraperMetadata, contextToClose: BrowserContext | undefined): Promise<FlightWithFares[]> => {
  const result = await scraperFunc(page, params.context).catch(async (e) => {
    if (page.isClosed()) return undefined
    log("* Error in scraper, taking screenshot *\n", e)

    const filename = `${meta.name}-${Date.now()}.png`
    await page.screenshot({ path: filename })
    log(`* Screenshot saved to ${process.cwd()}/${filename} *`)

    return undefined
  })

  await page.close().catch((err) => {})
  if (contextToClose) await contextToClose.close().catch((err) => {})

  if (result === undefined) {
    log("* Retrying *")
    const context = await params.page.browser().createIncognitoBrowserContext()
    const newPage = await context.newPage()
    await prepPage(newPage, meta)
    retriesDone += 1
    return runAttempt(newPage, params, scraperFunc, meta, context)
  }

  return result
}

const randId = Math.round(Math.random() * 1000)
export const log = (...args: any) => console.log(`[${(new Date()).toLocaleString()} ${curMeta.name}-${randId}] `, ...args)

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
type WaitForResponse = string | ((res: HTTPResponse) => boolean | Promise<boolean>)
type GotoPageOptions = { page: Page, url: string, maxResponseGapMs?: number, waitForResponse: WaitForResponse, waitUntil?: PuppeteerLifeCycleEvent, waitMoreWhen?: string[] }
export const gotoPageAndWaitForResponse = async ({ url, page, maxResponseGapMs = 7000, waitForResponse, waitMoreWhen = [] }: GotoPageOptions) => {
  let gapTimeoutTimer: number = -1
  let completed = false

  log(`going to url: ${url}`)
  void page.goto(url, { timeout: 0 }).then((resp) => {
    log("parent url finished loading")
    return resp ?? undefined

  }).catch((err) => {
    if (page.isClosed()) return undefined
    if (completed) return "already completed"    // the request had already finished
    log(`parent url error: ${err}`)
    return (err as Error).message
  })

  // Gap timeout timer
  let resolveFunc: TimerHandler
  const gapTimeoutProm = new Promise<string>((resolve) => {
    resolveFunc = () => { resolve("gap timeout") }
    gapTimeoutTimer = setTimeout(resolveFunc, maxResponseGapMs)
  })

  let waitMore = false
  const responseProm = page.waitForResponse((res: HTTPResponse) => {
    // If this callback happens after the request is done, ignore it
    if (completed) return true
    // if (!res.url().startsWith("data:")) log(`url coming in: ${res.url()}`)

    // Reset the gap timeout timer since we got a response
    clearTimeout(gapTimeoutTimer)
    if (waitMoreWhen.some((checkUrl) => res.url().includes(checkUrl))) {
      if (!waitMore) log("enabled waitextra!")
      waitMore = true
    }
    gapTimeoutTimer = setTimeout(resolveFunc, maxResponseGapMs + (waitMore ? 29000 - maxResponseGapMs : 0))

    if (typeof waitForResponse === "string") return res.url() === waitForResponse
    return waitForResponse!(res)
  }, { timeout: 0 })

  // Either we get a response or a timeout
  const ret = await Promise.race([responseProm, gapTimeoutProm])

  // Ensure that events don't happen after we're completed
  completed = true
  if (gapTimeoutTimer !== -1) clearTimeout(gapTimeoutTimer)

  // Timeouts resolve as strings
  if (typeof ret === "string") throw new Error(ret)

  // Early catch errors
  if (ret.status() !== 200) throw new Error(`Got status ${ret.status()}`)

  return ret
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
    //await sleep(400)

    if (matchedRule.rule.andContainsText) {
      const text = await matchedRule.element.evaluate((el) => el.textContent)
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
        await matchedRule.element.click({ offset: { x: 5, y: 5 } })
      } else if (matchedRule.rule.clickMethod === "eval") {
        await matchedRule.element.evaluate((el: any) => el.click())
      } else if (matchedRule.rule.clickMethod === "dont-click") {
        // do nothing
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
