import express from "express"
import { AwardWizScraperModule } from "./awardwiz-types.js"
import c from "ansi-colors"
import cors from "cors"
import { logger, logGlobal } from "./log.js"
import process from "node:process"
import { DebugOptions, Arkalis } from "../arkalis/arkalis.js"
import ArkalisDb from "../arkalis/db.js"
import Bottleneck from "bottleneck"

const debugOptions: DebugOptions = {
  useProxy: true,
  globalBrowserCacheDir: "./tmp/browser-cache",
  browserDebug: false,
  showRequests: false,
  log: (prettyLine: string, id: string) => logger.info(prettyLine, { id }),
  winston: logger,
  useResultCache: true,
  globalDb: await ArkalisDb.open("./tmp/arkalis.db")
}

const app = express()
app.use(cors({ origin: true }))

const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 })
app.use(async (req, res, next) => {
  logGlobal("Received request:", c.magenta(req.url))
  await limiter.schedule(async () => {
    logGlobal("Processing request:", c.magenta(req.url))
    next()
  })
})

app.get("/run/:scraperName(\\w+)-:origin([A-Z]{3})-:destination([A-Z]{3})-:departureDate(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  const { scraperName, origin, destination, departureDate } = req.params

  const scraper: AwardWizScraperModule = await import(`./scrapers/${scraperName}.js`)
  const query = { origin: origin!, destination: destination!, departureDate: departureDate! }

  const cacheKey = scraperName === "fr24"
    ? `${scraper.meta.name}-${query.origin}${query.destination}`
    : `${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`

  const results = await Arkalis.run(async (sc) => {
    sc.log("Running scraper for", query)
    const scraperResults = await scraper.runScraper(sc, query)
    sc.log(c.green(`Completed with ${scraperResults.length} results`))
    return scraperResults
  }, debugOptions, scraper.meta, cacheKey)    // [2013-01-01 05:32:00.123 united-SFOLAX-0220-U7fw]

  res.contentType("application/json")
  res.status(results.result === undefined ? 500 : 200)
  res.end(JSON.stringify(results))
})

// app.get("/health-check", async (req, res) => {
//   const result = await pool.runScraper(async (sc) => "ok", { name: "health-check" }, "health-check").catch(() => undefined)
//   res.status(result ? 200 : 500).send(result)
// })

app.get("/", (req, res) => {
  res.send("Hello!\n")
})

const port = parseInt(process.env["PORT"] ?? "2222")
const server = app.listen(port, () => {
  logGlobal(`Started Awardwiz HTTP server on port ${port}`)
})

process.on("SIGTERM", async () => {
  logGlobal("Received SIGTERM, shutting down")
  server.close()
  logger.close()
  process.exit(0)
})

process.on("uncaughtException", function(err) {
  logGlobal(c.red("Uncaught exception, quitting:"), err)
  process.exit(1)
})
