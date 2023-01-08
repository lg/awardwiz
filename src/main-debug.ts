import c from "ansi-colors"
import { logGlobal } from "./log.js"
import { createClient } from "@redis/client"
import { firefox } from "playwright-extra"
import { Scraper } from "./scraper.js"
import { throwIfBadResponse } from "./common.js"

const debugOptions = {
  showBrowserDebug: true,
  showUncached: true,
  useProxy: false,
  showBlocked: true,
  showFullRequest: [],
  showFullResponse: [],
  changeProxies: true,
  maxAttempts: 1,
  minBrowserPool: 1,
  maxBrowserPool: 1,
  pauseAfterRun: false,
  pauseAfterError: false,
}

const from = "LAX"
const to = "LIS"
const req = { params: { from, to } }
const fr24Url = `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${from}&destination=${to}`

const browser = new Scraper(firefox, debugOptions)
await browser.create()

const result = await browser.runAttempt(async (sc) => {
  sc.log("Querying FlightRader24 for carriers between:", req.params)
  sc.log(`Going to ${fr24Url}`)

  // on certain pairs fr24 times out after 10s even though it should have returned a 'no pairs' response
  const response = await sc.page.goto(fr24Url, { waitUntil: "domcontentloaded", timeout: 15000 })
  let textResponse = await response?.text()
  if (textResponse?.includes("Our engineers are working hard")) {
    sc.log(c.yellow(`FR24 returned an internal error, adding ${from}-${to} to cache regardless`))

    textResponse = JSON.stringify({"result":{"request":{"query":"default","limit":50,"format":"json","origin":from,"destination":to,"fetchBy":"","callback":null,"token":null,"pk":null},"response":{"flight":{"item":{"current":0},"timestamp":Date.now(),"data":null}}}})
    await sc.cache?.insertURLIntoCache(fr24Url, Buffer.from(textResponse, "utf8"), Buffer.from(JSON.stringify({ "Content-type": "application/json" }), "utf8"), 3600 * 24 * 7)

    // TODO: insert into cache
    return JSON.parse(textResponse)
  }

  await throwIfBadResponse(sc, response)
  return JSON.parse(await response!.text())
}, { name: "debug" }, "debug")

logGlobal(result)

logGlobal("Ending")
const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()
await redis.save()
await redis.disconnect()

await browser.context?.close()
await browser.browser?.close()
logGlobal("Ended")
