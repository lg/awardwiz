import express from "express"
import { log } from "./common.js"
import { runScraper } from "./scraper.js"
import { AwardWizScraperModule } from "./types.js"
import c from "ansi-colors"
const app = express()

app.get("/", (req, res) => {
  res.send("Hello!")
})

app.get("/run/:scraperName/:departureDate/:origin/:destination", async (req, res) => {
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

const port = parseInt(process.env.PORT ?? "8080")
app.listen(port, () => {
  console.log(`awardwiz-scrapers listening on port ${port}`)

  app._router.stack.forEach((r: any) => {
    if (r.route?.path)
      console.log(r.route.path)
  })
})
