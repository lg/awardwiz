import express from "express"
import { gotoPage } from "./common.js"
import { ScraperPool } from "./scraper-pool.js"
import { AwardWizScraperModule } from "./types.js"
import c from "ansi-colors"
import cors from "cors"
import { logGlobal } from "./log.js"
import https from "https"
import http from "http"
import fs from "fs"

const app = express()
const port = parseInt(process.env.PORT ?? "8282")
let server
if (process.env.HTTPS_KEY_PATH && process.env.HTTPS_CERT_PATH) {
  logGlobal(`Starting HTTPS server on port ${port}}`)
  server = https.createServer({
    key: fs.readFileSync(process.env.HTTPS_KEY_PATH),
    cert: fs.readFileSync(process.env.HTTPS_CERT_PATH),
  }, app)
} else {
  logGlobal(`Starting HTTP server on port ${port}}`)
  server = http.createServer(app)
}

const pool = new ScraperPool({
  showBrowserDebug: false,
  showUncached: false,
  maxAttempts: 5
})

app.get("/run/:scraperName(\\w+)-:origin([A-Z]{3})-:destination([A-Z]{3})-:departureDate(\\d{4}-\\d{2}-\\d{2})", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    logGlobal("Received query:", req.params)
    const { scraperName, origin, destination, departureDate } = req.params

    const scraper: AwardWizScraperModule = await import(`./scrapers/${scraperName}.js`)
    const query = { origin, destination, departureDate }

    const results = await pool.runScraper(async (sc) => {
      sc.log("Running scraper for", query)
      const scraperResults = await scraper.runScraper(sc, query)
      sc.log(c.green(`Completed with ${scraperResults.length} results`))
      return scraperResults
    }, { ...scraper.meta })

    res.contentType("application/json")
    res.status(results.result === undefined ? 500 : 200)
    res.end(JSON.stringify(results))
  })
})

app.get("/fr24/:from-:to", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    logGlobal("Received query:", req.params)
    const { from, to } = req.params
    const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${from}&destination=${to}`

    const result = await pool.runScraper(async (sc) => {
      sc.log("Querying FlightRader24 for carriers between:", req.params)
      const response = await gotoPage(sc, fr24Url, "domcontentloaded")
      return JSON.parse(await response!.text())
    }, { name: "fr24", forceCacheUrls: [fr24Url] })

    res.contentType("application/json")
    res.status(result.result === undefined ? 500 : 200)
    res.end(JSON.stringify(result))
  })
})

app.get("/", (req, res) => {
  logGlobal("Received query:", req.params)
  res.send("Hello!\n")
})

server.listen(port, () => {
  app._router.stack.forEach((r: any) => {
    if (r.route?.path)
      logGlobal(r.route.path)
  })
})
