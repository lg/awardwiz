/// <reference lib="dom" />

import { Page, Response } from "playwright"
import c from "ansi-colors"
import { Scraper } from "./scraper.js"

type WaitUntilStates = "load" | "domcontentloaded" | "networkidle" | "commit"

const NAV_WAIT_COMMIT_MS = 15000
const NAV_WAIT_EXTRA_MS = 25000

export const gotoPage = async (sc: Scraper, url: string, waitUntil: WaitUntilStates) => {
  sc.log(`Going to ${url}`)
  const load = await sc.page.goto(url, { waitUntil: "commit", timeout: NAV_WAIT_COMMIT_MS })
  sc.log(`Headers received, waiting for ${waitUntil}`)
  if (waitUntil !== "commit")
    await sc.page.waitForLoadState(waitUntil, { timeout: NAV_WAIT_EXTRA_MS })

  await throwIfBadResponse(sc, load)

  sc.log("Completed loading url")
  return load ?? undefined
}

export const throwIfBadResponse = async (sc: Scraper, response: Response | null) => {
  if (!response)
    throw new Error("Response was null!")

  if (response.status() !== 200) {
    const pageText = await response.text()
    if (pageText.includes("<H1>Access Denied</H1>"))
      throw new Error(`Access Denied while loading page (status: ${response.status()})`)
    if (pageText.includes("div class=\"px-captcha-error-header\""))
      throw new Error("Perimeter-X captcha while loading page")
    sc.log(pageText)

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

export const jsonParseLoggingError = <Type>(sc: Scraper, json: string): Type => {
  try {
    return JSON.parse(json)
  } catch (e) {
    sc.log(c.red("Error parsing JSON"), e, c.red("JSON:"), `${json}`)
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
