import { ScraperMetadata } from "../scraper.js"
import { AwardWizScraper } from "../types.js"
import { FlightRadar24Response } from "./samples/fr24.js"

export const meta: ScraperMetadata = {
  name: "fr24",
}

export const runScraper: AwardWizScraper<FlightRadar24Response> = async (sc, query) => {
  const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${query.origin}&destination=${query.destination}`
  sc.log("Querying FlightRader24 for carriers between:", query)
  sc.log(`Going to ${fr24Url}`)

  sc.browser.goto(fr24Url)
  const response = await sc.browser.waitFor({
    "success": { type: "url", url: fr24Url }
  })
  return JSON.parse(response.response?.body)
}
