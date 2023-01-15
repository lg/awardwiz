import c from "ansi-colors"
import { logGlobal } from "./log.js"
import { createClient } from "@redis/client"
import { chromium } from "playwright-extra"
import { DebugOptions, Scraper } from "./scraper.js"
import { AwardWizQuery, AwardWizScraperModule } from "./types.js"

const debugOptions: DebugOptions = {
  showBrowserDebug: true,
  maxAttempts: 5,
  minBrowserPool: 1,
  maxBrowserPool: 1,

  showBlocked: false,
  showFullRequest: [],
  showFullResponse: [],
  useProxy: true,

  showUncached: true,
  pauseAfterRun: true,
  pauseAfterError: true,
}

const browser = new Scraper(chromium, debugOptions)
await browser.create()

const scraper: AwardWizScraperModule = await import("./scrapers/delta.js")
const query: AwardWizQuery = { origin: "SFO", destination: "LAX", departureDate: "2023-07-20" }

const result = await browser.runAttempt(async (sc) => {
  sc.log("Using query:", query)
  const scraperResults = await scraper.runScraper(sc, query).catch(async (e) => {
    sc.log(c.red("Error in scraper"), e)
    sc.context?.setDefaultTimeout(0)
    await sc.pause()
    return []
  })
  sc.log(c.green(`Completed with ${scraperResults.length} results`), sc.stats?.toString())
  return scraperResults
}, scraper.meta, "debug")

logGlobal(result)

logGlobal("Ending")
const redis = createClient({ url: process.env["REDIS_URL"] })
await redis.connect()
await redis.save()
await redis.disconnect()

await browser.context?.close()
await browser.browser?.close()
logGlobal("Ended")
