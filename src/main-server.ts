import express from "express"
import { gotoPage, log } from "./common.js"
import { runScraper } from "./scraper.js"
import { AwardWizScraperModule } from "./types.js"
import c from "ansi-colors"
import cors from "cors"
const app = express()

app.get("/run/:scraperName/:departureDate/:origin/:destination", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    const { scraperName, origin, destination, departureDate } = req.params

    const scraper: AwardWizScraperModule = await import(`./scrapers/${scraperName}.js`)
    const query = { origin, destination, departureDate }

    const results = await runScraper(async (sc) => {
      log(sc, "Using query:", query)
      const scraperResults = await scraper.runScraper(sc, query)
      log(sc, c.green(`Completed with ${scraperResults.length} results`))
      return scraperResults
    }, { ...scraper.meta })

    res.contentType("application/json")
    res.status(results.result === undefined ? 500 : 200)
    res.end(JSON.stringify(results))
  })
})

app.get("/fr24/:from/:to", async (req, res) => {
  cors({ origin: true })(req, res, async () => {
    const { from, to } = req.params
    const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${from}&destination=${to}`

    const result = await runScraper(async (sc) => {
      log(sc, "Querying FlightRader24 for carriers between:", req.params)
      const response = await gotoPage(sc, fr24Url, "domcontentloaded")
      return JSON.parse(await response!.text())
    }, { name: "fr24", unsafeHttpsOk: true, forceCache: [fr24Url] })

    res.contentType("application/json")
    res.status(result.result === undefined ? 500 : 200)
    res.end(JSON.stringify(result))
  })
})

app.get("/", (req, res) => {
  res.send("Hello!")
})

const port = parseInt(process.env.PORT ?? "8282")
app.listen(port, () => {
  console.log(`awardwiz-scrapers listening on port ${port}`)

  app._router.stack.forEach((r: any) => {
    if (r.route?.path)
      console.log(r.route.path)
  })
})
