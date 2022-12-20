/// <reference lib="dom" />

import { Page } from "playwright"
import dayjs from "dayjs"
import { ScraperMetadata, ScraperRequest } from "./scraper.js"

type WaitUntilStates = "load" | "domcontentloaded" | "networkidle" | "commit"

const NAV_WAIT_COMMIT_MS = 5000
const NAV_WAIT_EXTRA_MS = 25000

export const gotoPage = async (aw: ScraperRequest, url: string, waitUntil: WaitUntilStates) => {
  log(aw, `Going to ${url}`)
  const load = await aw.page.goto(url, { waitUntil: "commit", timeout: NAV_WAIT_COMMIT_MS })
  log(aw, `Headers received, waiting for ${waitUntil}`)
  if (waitUntil !== "commit")
    await aw.page.waitForLoadState(waitUntil, { timeout: NAV_WAIT_EXTRA_MS })

  if (load && load.status() !== 200) {
    const pageText = await load.text()
    if (pageText.includes("<H1>Access Denied</H1>"))
      throw new Error(`Access Denied while loading page (status: ${load.status()})`)
    if (pageText.includes("div class=\"px-captcha-error-header\""))
      throw new Error("Perimeter-X captcha while loading page")
    log(aw, pageText)

    throw new Error(`Page loading failed with status ${load.status()}`)
  }

  log(aw, "Completed loading url")
  return load ?? undefined
}

export const xhrFetch = async (page: Page, url: string, init: RequestInit, timeoutMs: number = NAV_WAIT_EXTRA_MS) => {
  // eslint-disable-next-line no-shadow
  return page.evaluate(async ({ url, init, timeoutMs }) => {
    const ac = new AbortController()
    const { signal } = ac
    void setTimeout(() => { ac.abort() }, timeoutMs)

    const fetchResponse = await fetch(url, { ...init, signal })
    return fetchResponse.text()
  }, { url, init, timeoutMs })
}

export const log = (aw: { meta: ScraperMetadata, randId: number, logLines: string[] } , ...toLog: any) => {
  const start = `[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")} ${aw.meta.name}-${aw.randId}]`
  aw.logLines.push([start, ...toLog].map((line) => ((typeof line === "string") ? line : JSON.stringify(line))).join(" "))
  console.log(start, ...toLog)
}

