import { log } from "./common.js"
import { runScraper } from "./scraper.js"
import { AwardWizScraperModule, AwardWizQuery } from "./types.js"
import c from "ansi-colors"

for (let i: number = 0; i < 1; i += 1) {
  const scraper: AwardWizScraperModule = await import("./scrapers/united.js")
  const query: AwardWizQuery = { origin: "EWR", destination: "SFO", departureDate: "2023-01-25" }

  await runScraper(async (sc) => {
    log(sc, "Using query:", query)
    const scraperResults = await scraper.runScraper(sc, query)
    log(sc, c.green(`Completed with ${scraperResults.length} results`))
    return scraperResults
  }, { ...scraper.meta }, {
    showUncached: true,
    noProxy: false,
    showBlocked: true,
    outputResponse: []
  })
}

// await runScraper(async (sc) => {
// }, { name: "test", noBlocking: true, noProxy: false }, { showUncached: true })
