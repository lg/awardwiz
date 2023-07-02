import c from "ansi-colors"
import { logger, logGlobal } from "./log.js"
import { AwardWizQuery, AwardWizScraperModule } from "./awardwiz-types.js"
import { DebugOptions, runArkalis } from "../arkalis/arkalis.js"
import * as dotenv from "dotenv"
dotenv.config()

const options: DebugOptions = {
  maxAttempts: 1,
  useProxy: true,
  pauseAfterRun: false,
  pauseAfterError: true,
  drawMousePath: false,
  liveLog: (prettyLine: string, id: string) => logger.info(prettyLine, { id }),
  winston: logger,

  useResultCache: true,
  globalCachePath: "./tmp/arkalis-cache",
  browserDebug: true
}

const [scraperName, origin, destination, departureDate] = process.argv.slice(-4)
if (!scraperName || !origin || !destination || !departureDate)
  throw new Error("Incorrect usage. Example: <executable> delta SFO LAX 2023-05-01")

const scraper = await import(`./scrapers/${scraperName}.js`) as AwardWizScraperModule
const query: AwardWizQuery = { origin, destination, departureDate }

const result = await runArkalis(async (arkalis) => {
  arkalis.log("Using query:", query)
  return scraper.runScraper(arkalis, query)
}, options, scraper.meta, `debug-${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`)

if (result.result === undefined)
  logGlobal("Results: (undefined)")
else
  logGlobal(Array.isArray(result.result)
    ? `Results: ${c.greenBright(result.result.length.toLocaleString())} item(s)`
    : `Results: ${c.greenBright(JSON.stringify(result.result).length.toLocaleString())} bytes`)

logger.close()