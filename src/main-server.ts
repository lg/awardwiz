import express from "express"
import { gotoPage } from "./common.js"
import { ScraperPool } from "./scraper-pool.js"
import { AwardWizScraperModule } from "./types.js"
import c from "ansi-colors"
import cors from "cors"
import { logGlobal } from "./log.js"

const app = express()
app.use((req, res, next) => {
  logGlobal("Received request:", c.magenta(req.url))
  next()
})

const pool = new ScraperPool({
  showBrowserDebug: true,
  showUncached: false,
  maxAttempts: 5,
  minBrowserPool: 3,
  maxBrowserPool: 4,
})

app.get("/run/:scraperName(\\w+)-:origin([A-Z]{3})-:destination([A-Z]{3})-:departureDate(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    const { scraperName, origin, destination, departureDate } = req.params

    const scraper: AwardWizScraperModule = await import(`./scrapers/${scraperName}.js`)
    const query = { origin, destination, departureDate }

    const results = await pool.runScraper(async (sc) => {
      sc.log("Running scraper for", query)
      const scraperResults = await scraper.runScraper(sc, query)
      sc.log(c.green(`Completed with ${scraperResults.length} results`))
      return scraperResults
    }, { ...scraper.meta }, `${Math.random().toString(36).substring(2, 6)}-${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`)    // [2013-01-01 05:32:00.123 U7fw-united-SFOLAX-0220]

    res.contentType("application/json")
    res.status(results.result === undefined ? 500 : 200)
    res.end(JSON.stringify(results))
  })
})

app.get("/fr24/:from-:to", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    const { from, to } = req.params

    if ((from === "LAX" && to === "LIS") || (from === "AMS" && to === "YVR")) {
      res.contentType("application/json")
      res.status(200)
      res.end(JSON.stringify({"result":{"request":{"query":"default","limit":50,"format":"json","origin":from,"destination":to,"fetchBy":"","callback":null,"token":null,"pk":null},"response":{"flight":{"item":{"current":0},"timestamp":Date.now(),"data":null}}}}))
      return
    }

    const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${from}&destination=${to}`

    const result = await pool.runScraper(async (sc) => {
      sc.log("Querying FlightRader24 for carriers between:", req.params)
      const response = await gotoPage(sc, fr24Url, "domcontentloaded")
      return JSON.parse(await response!.text())
    }, { name: "fr24", forceCacheUrls: [fr24Url] }, `fr24-${from}-${to}`)

    res.contentType("application/json")
    res.status(result.result === undefined ? 500 : 200)
    res.end(JSON.stringify(result))
  })
})

app.get("/health-check", async (req, res) => {
  const result = await pool.runScraper(async (sc) => "ok", { name: "health-check" }, "health-check").catch(() => undefined)
  res.status(result ? 200 : 500).send(result)
})

app.get("/", (req, res) => {
  res.send("Hello!\n")
})

const port = parseInt(process.env.PORT ?? "8282")
const server = app.listen(port, () => {
  logGlobal(`Started Awardwiz HTTP server on port ${port}`)
})

process.on("SIGTERM", async () => {
  logGlobal("Received SIGTERM, shutting down")
  server.close()
  await pool.drainAll()
  process.exit(0)
})

process.on("uncaughtException", function(err) {
  if (err.stack?.toString().includes("playwright-extra")) {
    logGlobal(c.yellow("Playwright-extra race condition error, ignoring"))
  } else {
    logGlobal(c.red("Uncaught exception, quitting:"), err)
    process.exit(1)
  }
})
