import axios, { AxiosError } from "axios"
import * as fs from "fs/promises"
import * as ts from "typescript/lib/typescript.js"
import { ScraperQuery, ScraperResponse } from "../types/scrapers"

const main = (async () => {
  console.log("loading files")
  const query = { origin: "YYZ", destination: "YOW", scraper: "aeroplan", departureDate: "2022-08-09" }
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

void main()

export {}
