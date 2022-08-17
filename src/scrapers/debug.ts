import axios, { AxiosError } from "axios"
import * as fs from "fs/promises"
import * as ts from "typescript/lib/typescript.js"
import { ScraperQuery, ScraperResponse } from "../types/scrapers"

const [origin, destination, departureDate, scraper, mode, ip] = process.argv[2].split(",")

const mainRemote = (async () => {
  console.log("loading files")
  const query = { origin, destination, scraper, departureDate }
  const commonTS = await fs.readFile("src/scrapers/common.ts", "utf8")
  const scraperTS = await fs.readFile(`src/scrapers/${query.scraper}.ts`, "utf8")

  console.log("building")
  const tsCode = scraperTS.replace(/import .* from "\.\/common"/, commonTS)
  const jsCode = ts.transpile(tsCode, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS })

  console.log(`running: ${JSON.stringify(query)}`)
  const postData: { code: string, context: ScraperQuery } = { code: jsCode, context: query }
  const startTime = Date.now()
  const config = (await fs.readFile(".env.local", "utf8")).split("\n").reduce((acc: Record<string, string>, line) => { const [key, value] = line.split("="); acc[key] = value; return acc }, {})
  const raw = await axios.post<ScraperResponse>(`${config.VITE_BROWSERLESS_AWS_PROXY_URL}/function`, postData, { headers: { "x-api-key": config.VITE_BROWSERLESS_AWS_PROXY_API_KEY } }).catch((err) => err)

  console.log(`completed in: ${(Date.now() - startTime).toLocaleString()} ms`)
  if (raw instanceof AxiosError && raw.response) {
    console.log(`error: ${raw.response.status} ${raw.response.statusText}\n${JSON.stringify(raw.response.data, null, 2)}`)

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
  await browser.close().catch((e) => {})
  console.log("ok done")
})

if (mode === "browserless-func")
  void mainRemote().catch((e) => { console.log(e); process.exit(1) })
if (mode === "browserless-websockets" || mode === "chromium")
  void mainLocal().catch((e) => { console.log(e); process.exit(1) })

export {}
