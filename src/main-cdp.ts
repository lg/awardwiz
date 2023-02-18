import { CDPBrowser } from "./cdp-browser.js"
import { logGlobal, logger } from "./log.js"

const browser = new CDPBrowser()
await browser.launch()

const query = { origin: "SFO", destination: "LAX", departureDate: "2023-03-01"}
const paramsText = `org0=${query.origin}&dest0=${query.destination}&departureDate0=${query.departureDate}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=TNB`
await browser.goto(`https://www.aircanada.com/aeroplan/redeem/availability/outbound?${paramsText}`)
const result = await browser.waitFor({
  "success": { type: "url", url: "*/loyalty/dapidynamic/*/v2/search/air-bounds", statusCode: 200 },
  "antibotting1": { type: "url", url: "*/aeroplan/redeem/" },
  "antibotting2": { type: "url", url: "*/loyalty/dapidynamic/*/v2/reward/market-token", statusCode: 403 },
  "antibotting3": { type: "html", html: "Air Canada's website is not available right now." }
}, 30000)
logGlobal("result", result)

await browser.close()
logger.close()
