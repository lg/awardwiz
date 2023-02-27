import c from "ansi-colors"
import { logger, logGlobal } from "./log.js"
import { DebugOptions, Scraper } from "./scraper.js"
import { AwardWizQuery, AwardWizScraperModule } from "./types.js"
import dayjs from "dayjs"

const debugOptions: Partial<DebugOptions> = {
  maxAttempts: 5,
  useProxy: true,
  pauseAfterRun: false,
  pauseAfterError: true,
}

if (process.argv.length < 6) {
  const defaultParams = ["delta", "SFO", "LAX", dayjs().format("YYYY-MM-DD")]
  logGlobal("Using default params for search", defaultParams)
  process.argv.push(...defaultParams)
}

const browser = new Scraper(debugOptions)

const scraper: AwardWizScraperModule = await import(`./scrapers/${process.argv[2]}.js`)
const query: AwardWizQuery = { origin: process.argv[3]!, destination: process.argv[4]!, departureDate: process.argv[5]! }

const result = await browser.run(async (sc) => {
  sc.log("Using query:", query)
  return scraper.runScraper(sc, query)
}, scraper.meta, `debug-${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`)

logGlobal(`Results: ${c.greenBright(result.result?.length.toString() ?? c.redBright("0"))}`)

logger.close()