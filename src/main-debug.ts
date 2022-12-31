import { log } from "./common.js"
import { runScraper } from "./scraper.js"
import { AwardWizScraperModule, AwardWizQuery } from "./types.js"
import c from "ansi-colors"
// import dayjs from "dayjs"

for (let i: number = 0; i < 1; i += 1) {
  const scraper: AwardWizScraperModule = await import("./scrapers/united.js")
  const randomDate = "2023-01-02" // dayjs().add(Math.floor(Math.random() * 180), "day").format("YYYY-MM-DD")
  const flights = [["LIH", "SFO"]] //[["SFO", "LAX"], ["LAX", "SFO"], ["SAN", "SJC"], ["SJC", "SAN"], ["OAK", "HNL"]]
  const flight = flights[Math.floor(Math.random() * flights.length)]
  const query: AwardWizQuery = { origin: flight[0], destination: flight[1], departureDate: randomDate }

  await runScraper(async (sc) => {
    log(sc, "Using query:", query)
    const scraperResults = await scraper.runScraper(sc, query)
    log(sc, c.green(`Completed with ${scraperResults.length} results`))
    return scraperResults

  }, scraper.meta, {
    showUncached: true,
    noProxy: false,
    showBlocked: false,
    showFullRequest: [],
    showFullResponse: [],
    pauseAfterRun: true,
    pauseAfterError: true,
    changeProxies: true,
    maxAttempts: 3,
  })
}

// await runScraper(async (sc) => {
// }, { name: "test", noBlocking: true, noProxy: false }, { showUncached: true })
