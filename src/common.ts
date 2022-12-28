/// <reference lib="dom" />

import { Page, Response } from "playwright"
import dayjs from "dayjs"
import { ScraperMetadata, ScraperRequest } from "./scraper.js"
import c from "ansi-colors"

type WaitUntilStates = "load" | "domcontentloaded" | "networkidle" | "commit"

const NAV_WAIT_COMMIT_MS = 7000
const NAV_WAIT_EXTRA_MS = 25000

export const gotoPage = async (aw: ScraperRequest, url: string, waitUntil: WaitUntilStates) => {
  log(aw, `Going to ${url}`)
  const load = await aw.page.goto(url, { waitUntil: "commit", timeout: NAV_WAIT_COMMIT_MS })
  log(aw, `Headers received, waiting for ${waitUntil}`)
  if (waitUntil !== "commit")
    await aw.page.waitForLoadState(waitUntil, { timeout: NAV_WAIT_EXTRA_MS })

  await throwIfBadResponse(aw, load)

  log(aw, "Completed loading url")
  return load ?? undefined
}

export const throwIfBadResponse = async (aw: ScraperRequest, response: Response | null) => {
  if (!response)
    throw new Error("Response was null!")

  if (response.status() !== 200) {
    const pageText = await response.text()
    if (pageText.includes("<H1>Access Denied</H1>"))
      throw new Error(`Access Denied while loading page (status: ${response.status()})`)
    if (pageText.includes("div class=\"px-captcha-error-header\""))
      throw new Error("Perimeter-X captcha while loading page")
    log(aw, pageText)

    throw new Error(`Page loading failed with status ${response.status()}`)
  }
}

export const xhrFetch = async (page: Page, url: string, init: RequestInit, timeoutMs: number = NAV_WAIT_EXTRA_MS) => {
  // eslint-disable-next-line no-shadow
  return page.evaluate(async ({ url, init, timeoutMs }) => {
    const ac = new AbortController()
    const { signal } = ac
    // eslint-disable-next-line no-restricted-globals
    void setTimeout(() => { ac.abort() }, timeoutMs)

    const fetchResponse = await fetch(url, { ...init, signal })
    return fetchResponse.text()
  }, { url, init, timeoutMs })
}

type ScraperRequestMinimumForLogging = { meta: ScraperMetadata, randId: number, logLines: string[] }
export const log = (aw: ScraperRequestMinimumForLogging, ...toLog: any) => {
  const start = `[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")} ${aw.meta.name}-${aw.randId}]`
  aw.logLines.push([start, ...toLog].map((line) => ((typeof line === "string") ? line : JSON.stringify(line))).join(" "))
  console.log(start, ...toLog)
}

export const jsonParseLoggingError = <Type>(aw: ScraperRequestMinimumForLogging, json: string): Type => {
  try {
    return JSON.parse(json)
  } catch (e) {
    log(aw, c.red("Error parsing JSON"), e, c.red("JSON:"), `${json}`)
    throw e
  }
}

export const jsonParse = <Type>(json: string): Type | undefined => {
  try {
    return JSON.parse(json)
  } catch (e) {
    return undefined
  }
}
