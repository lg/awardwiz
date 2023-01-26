/// <reference lib="dom" />

import { Locator, Page, Response } from "playwright"
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

export const throwIfBadResponse = async (sc: Scraper, response: Response | null | undefined) => {
  if (!response)
    throw new Error("Response was null!")

  if (!response.ok()) {
    const pageText = await response.text()
    if (pageText.includes("<H1>Access Denied</H1>"))
      throw new Error(`Access Denied anti-botting while loading page (status: ${response.status()})`)
    if (pageText.includes("div class=\"px-captcha-error-header\""))
      throw new Error("Perimeter-X captcha anti-botting while loading page")
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

export const waitForLocatorAndClick = async (locator: Locator, notFoundLocator: Locator) => {
  const found = await Promise.race([
    locator.waitFor().then(() => "found").catch(() => "not found"),
    notFoundLocator.waitFor().then(() => "not found").catch(() => "not found"),
  ])
  if (found === "not found") { return false }
  return true
}

export const waitFor = async (sc: Scraper, locators: Record<string, Locator | Promise<any>>) => {
  const result = await Promise.race([
    ...Object.entries(locators).map(([key, locator]) => (locator instanceof Promise ? locator : locator.waitFor()).then(() => key).catch((e: Error) => e))
  ])
  if (result instanceof Error)
    throw result
  return result
}

export const waitForJsonSuccess = async <JSONType>(sc: Scraper, url: string, problems: Record<string, Locator | Promise<any>>) => {
  const response = await Promise.race([
    sc.page.waitForResponse((resp) => (resp.url() === url && resp.request().method() === "POST")).then((resp) => resp).catch((e: Error) => e),
    ...Object.entries(problems).map(([key, locator]) => (locator instanceof Promise ? locator : locator.waitFor()).then(() => key).catch((e: Error) => e))
  ])
  if (response instanceof Error)
    throw response
  else if (typeof response === "string")
    return response

  await throwIfBadResponse(sc, response)
  return jsonParseLoggingError(sc, await response.text()) as JSONType
}
