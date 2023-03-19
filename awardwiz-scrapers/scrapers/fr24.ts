import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { AwardWizScraper } from "../awardwiz-types.js"
import { FlightRadar24Response } from "../scraper-types/fr24.js"

export const meta: ScraperMetadata = {
  name: "fr24",
}

export const runScraper: AwardWizScraper<FlightRadar24Response> = async (arkalis, query) => {
  const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${query.origin}&destination=${query.destination}`
  arkalis.log("Querying FlightRader24 for carriers between:", query)
  arkalis.log(`Going to ${fr24Url}`)

  arkalis.goto(fr24Url)
  const response = await arkalis.waitFor({
    "success": { type: "url", url: fr24Url }
  })
  return JSON.parse(response.response?.body)
}
