import express from "express"
import { AwardWizScraperModule } from "./types.js"
import c from "ansi-colors"
import cors from "cors"
import { logger, logGlobal } from "./log.js"
import process from "node:process"
import { DebugOptions, Scraper } from "./scraper.js"

const debugOptions: Partial<DebugOptions> = {
  maxAttempts: 5,
  useProxy: true,
  pauseAfterRun: false,
  pauseAfterError: false,
}

const app = express()
app.use((req, res, next) => {
  logGlobal("Received request:", c.magenta(req.url))
  next()
})

app.get("/run/:scraperName(\\w+)-:origin([A-Z]{3})-:destination([A-Z]{3})-:departureDate(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    const { scraperName, origin, destination, departureDate } = req.params

    const scraper: AwardWizScraperModule = await import(`./scrapers/${scraperName}.js`)
    const query = { origin: origin!, destination: destination!, departureDate: departureDate! }

    const browser = new Scraper(debugOptions)
    const results = await browser.run(async (sc) => {
      sc.log("Running scraper for", query)
      const scraperResults = await scraper.runScraper(sc, query)
      sc.log(c.green(`Completed with ${scraperResults.length} results`))
      return scraperResults
    }, { ...scraper.meta }, `${Math.random().toString(36).substring(2, 6)}-${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`)    // [2013-01-01 05:32:00.123 U7fw-united-SFOLAX-0220]
    await browser.destroy()

    res.contentType("application/json")
    res.status(results.result === undefined ? 500 : 200)
    res.end(JSON.stringify(results))
  })
})

// app.get("/fr24/:from-:to", async (req, res) => {
//   cors({ origin: true })(req, res, async () => {
//     const { from, to } = req.params
//     const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${from}&destination=${to}`

//     const browser = new Scraper(debugOptions)
//     const result = await browser.run(async (sc) => {
//       sc.log("Querying FlightRader24 for carriers between:", req.params)
//       sc.log(`Going to ${fr24Url}`)

//       const response = await sc.page.goto(fr24Url, { waitUntil: "domcontentloaded", timeout: 15000 })
//       if (!response?.ok())
//         throw new Error(`FR24 returned ${response?.status()} for ${fr24Url}`)
//       return response!.json()
//     }, { name: "fr24", useBrowsers: ["firefox"] }, `fr24-${from}-${to}`)

//     res.contentType("application/json")
//     res.status(result.result === undefined ? 500 : 200)
//     res.end(JSON.stringify(result))
//   })
// })

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
  if (err.stack?.toString().includes("playwright-extra"))
    return
  logGlobal(c.red("Uncaught exception, quitting:"), err)
  process.exit(1)
})
