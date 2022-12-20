import { log } from "./common.js"
import { runScraper } from "./scraper.js"
import { AwardWizScraperModule, AwardWizQuery } from "./types.js"

for (let i: number = 0; i < 5; i += 1) {
  await runScraper(async (sc) => {
    const scraper: AwardWizScraperModule = await import("./scrapers/aa.js")
    const query: AwardWizQuery = { origin: "JFK", destination: "SFO", departureDate: "2022-12-20" }
    log(sc, "Using query:", query)
    return scraper.runScraper(sc, query)
  }, { name: "test" })
}
