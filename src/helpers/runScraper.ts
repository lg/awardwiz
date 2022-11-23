import { QueryKey } from "@tanstack/react-query"
import axios, { GenericAbortSignal } from "axios"
import ts from "typescript"
import { DatedRoute } from "../hooks/useAwardSearch"
import { BrowserlessPostData, ScraperResponse } from "../types/scrapers"
import { firebaseApp, firebaseAuth } from "./firebase"

const scraperCode = import.meta.glob("../scrapers/*.ts", { as: "raw" })

const scraperPath = (name: string) => {
  const localPath = Object.keys(scraperCode).find((scraperKey) => scraperKey.includes(`${name}.ts`))
  if (!localPath) throw new Error(`Could not find scraper ${name}`)
  return localPath
}

export const runScraper = async (scraperName: string, datedRoute: DatedRoute, queryKey: QueryKey, signal: GenericAbortSignal | undefined) => {
  const tsCodeCommon = await scraperCode[scraperPath("common")]()
  let tsCode = await scraperCode[scraperPath(scraperName)]()
  tsCode = tsCode.replace(/import .* from "\.\/common"/, tsCodeCommon)

  const url = `https://firestore.googleapis.com/v1beta1/projects/${firebaseApp.options.projectId}/databases/(default)/documents/scraper_runs?key=${firebaseApp.options.apiKey}`
  tsCode = tsCode.replace("const FIREBASE_SCRAPER_RUNS_URL_WITH_KEY = \"\"", `const FIREBASE_SCRAPER_RUNS_URL_WITH_KEY = "${url}"`)
  tsCode = tsCode.replace("const FIREBASE_UID = \"unknown\"", `const FIREBASE_UID = "${firebaseAuth.currentUser?.uid ?? "unknown"}"`)

  const jsCode = ts.transpile(tsCode, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS })
  const postData: BrowserlessPostData = { code: jsCode, context: { ...datedRoute } }
  return axios.post<ScraperResponse>(`${import.meta.env.VITE_BROWSERLESS_AWS_PROXY_URL}/function?key=${queryKey}`, postData, { headers: { "x-api-key": import.meta.env.VITE_BROWSERLESS_AWS_PROXY_API_KEY }, signal })
}
