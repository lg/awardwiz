import express from "express"
import { AwardWizScraperModule } from "./awardwiz-types.js"
import c from "ansi-colors"
import cors from "cors"
import { logger, logGlobal } from "./log.js"
import process from "node:process"
import { DebugOptions, Arkalis } from "../arkalis/arkalis.js"

const debugOptions: DebugOptions = {
  useProxy: true,
  globalCacheDir: "./tmp/cache",
  browserDebug: false,
  showRequests: false,
  log: (prettyLine: string, id: string) => logger.info(prettyLine, { id }),
  winston: logger,
}

const app = express()
app.use(cors({ origin: true }))

app.use((req, res, next) => {
  logGlobal("Received request:", c.magenta(req.url))
  next()
})

app.get("/run/:scraperName(\\w+)-:origin([A-Z]{3})-:destination([A-Z]{3})-:departureDate(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  const { scraperName, origin, destination, departureDate } = req.params

  const scraper: AwardWizScraperModule = await import(`./scrapers/${scraperName}.js`)
  const query = { origin: origin!, destination: destination!, departureDate: departureDate! }

  const results = await Arkalis.run(async (sc) => {
    sc.log("Running scraper for", query)
    const scraperResults = await scraper.runScraper(sc, query)
    sc.log(c.green(`Completed with ${scraperResults.length} results`))
    return scraperResults
  }, debugOptions, scraper.meta, `${Math.random().toString(36).substring(2, 6)}-${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`)    // [2013-01-01 05:32:00.123 U7fw-united-SFOLAX-0220]

  res.contentType("application/json")
  res.status(results.result === undefined ? 500 : 200)
  res.end(JSON.stringify(results))
})

// app.get("/trace/:traceId", async (req, res) => {
//   cors({ origin: true })(req, res, async () => {
//     const { traceId } = req.params
//     const result = await pool.runScraper(async (sc) => sc.cache?.getFromCache(`tracing:${traceId}`), { name: "trace" }, `trace-${traceId}`)
//     if (result.result) {
//       res.writeHead(200, { "Content-Type": "application/zip" })
//       res.end(result.result)
//     } else {
//       res.status(404).send("Not found")
//     }
//   })
// })

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
