/* eslint-disable @typescript-eslint/prefer-ts-expect-error */
import { AxiosError } from "axios"
import * as fs from "node:fs/promises"
import { ScraperQuery, ScraperResponse } from "../types/scrapers"

const [origin, destination, departureDate, scraper, mode, ip] = process.argv[2].split(",")

const mainRemote = (async () => {
  console.log("loading files")
  const query = { origin, destination, scraper, departureDate }
  const commonTS = await fs.readFile("src/scrapers/common.ts", "utf8")
  const scraperTS = await fs.readFile(`src/scrapers/${query.scraper}.ts`, "utf8")

  console.log("building")
  const ts = require("typescript/lib/typescript.js")
  const tsCode = scraperTS.replace(/import .* from "\.\/common"/, commonTS)
  const jsCode = ts.transpile(tsCode, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS })

  console.log(`running: ${JSON.stringify(query)}`)
  const postData: { code: string, context: ScraperQuery } = { code: jsCode, context: query }
  const startTime = Date.now()
  const environment = await fs.readFile(".env.local", "utf8")
  const config = environment.split("\n").reduce((result: Record<string, string>, line) => { const [key, value] = line.split("="); result[key] = value; return result }, {})
  const axios = await import("axios")
  // @ts-ignore
  const raw = await axios.post<ScraperResponse>(`${config.VITE_BROWSERLESS_AWS_PROXY_URL}/function`, postData, { headers: { "x-api-key": config.VITE_BROWSERLESS_AWS_PROXY_API_KEY } }).catch((error) => error)

  console.log(`completed in: ${(Date.now() - startTime).toLocaleString()} ms`)
  if (raw instanceof AxiosError && raw.response) {
    console.log(`error: ${raw.response.status} ${raw.response.statusText}\n${JSON.stringify(raw.response.data, undefined, 2)}`)

  } else {
    console.log("results:")
    console.log(JSON.stringify(raw.data))
  }
})

const mainLocal = (async () => {
  const puppeteer = await import("puppeteer")

  let browser
  if (mode === "browserless-websockets")
    browser = await puppeteer.connect({ browserWSEndpoint: `ws://${ip}:4000`, defaultViewport: { width: 1400, height: 800 } })
  else if (mode === "chromium")
    browser = await puppeteer.launch({ headless: false, devtools: true, defaultViewport: { width: 1300, height: 800 } })
  else
    throw new Error("invalid mode")

  const browserContext = await browser.createIncognitoBrowserContext()
  const page = await browserContext.newPage()

  const scraperImport = await import(`./${scraper}`) as any
  const results = await scraperImport({ page, browser, context: { origin, destination, departureDate } })
  console.log(JSON.stringify(results))

  console.log("closing browser!")
  await browser.close().catch((error) => {})
  console.log("ok done")
})

if (mode === "browserless-func")
  // @ts-ignore
  void mainRemote()
else
  // @ts-ignore
  void mainLocal()

export {}
