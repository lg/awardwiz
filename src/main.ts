import { log } from "./common.js"
import { runScraper } from "./scraper.js"
import { AwardWizScraperModule, AwardWizQuery } from "./types.js"
import c from "ansi-colors"

for (let i: number = 0; i < 5; i += 1) {
  const scraper: AwardWizScraperModule = await import("./scrapers/aa.js")
  const query: AwardWizQuery = { origin: "JFK", destination: "SFO", departureDate: "2022-12-25" }

  await runScraper(async (sc) => {
    log(sc, "Using query:", query)
    const scraperResults = await scraper.runScraper(sc, query)
    log(sc, c.green(`Completed with ${scraperResults.length} results`))
    return scraperResults
  }, { ...scraper.meta }, { showUncached: false, trace: false, noProxy: false }).catch((e) => {
    console.log(c.red("Ended scraper in error"), c.red(e))
  })
}

// await runScraper(async (sc) => {
// }, { name: "test", noBlocking: true, noProxy: false }, { showUncached: true })