import { Arkalis, ScraperMetadata } from "../../arkalis/arkalis.js"
import { AwardWizScraper } from "../awardwiz-types.js"
import { FlightRadar24Response } from "../scraper-types/fr24.js"

export const meta: ScraperMetadata = {
  name: "fr24",
  resultCacheTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 days
}

export const runScraper: AwardWizScraper<FlightRadar24Response> = async (arkalis: Arkalis, query) => {
  const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${query.origin}&destination=${query.destination}`
  arkalis.log("Querying FlightRader24 for carriers between:", query)
  arkalis.log(`Going to ${fr24Url}`)

  arkalis.goto(fr24Url)
  const response = await arkalis.waitFor({
    "success": { type: "url", url: fr24Url }
  })
  if (response.response!.status === 520) {
    arkalis.warn("FlightRadar24 returned 520 error, usually for invalid routes. Returning empty results.")
    return { result: undefined } as FlightRadar24Response
  }

  return JSON.parse(response.response!.body) as FlightRadar24Response
}
