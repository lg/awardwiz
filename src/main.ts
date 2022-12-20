import { runScraper } from "./scraper.js"
import { AwardWizScraperModule, AwardWizQuery } from "./types.js"

for (let i: number = 0; i < 5; i += 1) {
  const scraper: AwardWizScraperModule = await import("./scrapers/aa.js")
  const params: AwardWizQuery = { origin: "JFK", destination: "SFO", departureDate: "2022-12-20" }
  await runScraper(scraper, params)
}
