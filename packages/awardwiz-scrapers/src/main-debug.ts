import c from "ansi-colors"
import { logger, logGlobal } from "./log.js"
import { AwardWizQuery, AwardWizScraperModule } from "./awardwiz-types.js"
import { Arkalis, DebugOptions } from "arkalis"

const options: DebugOptions = {
  maxAttempts: 5,
  useProxy: true,
  pauseAfterRun: false,
  pauseAfterError: true,
  drawMousePath: false,
  log: (prettyLine: string, id: string) => logger.info(prettyLine, { id }),
  winston: logger,
}

if (process.argv.length < 6)
  throw new Error("Not enough arguments. Example: <executable> delta SFO LAX 2023-05-01")

const scraper: AwardWizScraperModule = await import(`./scrapers/${process.argv[2]}.js`)
const query: AwardWizQuery = { origin: process.argv[3]!, destination: process.argv[4]!, departureDate: process.argv[5]! }

const result = await Arkalis.run(async (sc) => {
  sc.log("Using query:", query)
  return scraper.runScraper(sc, query)
}, options, scraper.meta, `debug-${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`)

logGlobal(`Results: ${c.greenBright(result.result?.length.toString() ?? c.redBright("0"))}`)

logger.close()