import { CDPBrowser } from "./cdp-browser.js"
// import { logGlobal } from "./log.js"

const browser = new CDPBrowser()
await browser.launch("/Users/lg/proj/firefox/firefox-109/obj-aarch64-apple-darwin22.3.0/dist/Firefox.app/Contents/MacOS/firefox", "/tmp/ff-profile3", {})

//const query = { origin: "SFO", destination: "LAX", departureDate: "2023-03-01"}
// const paramsText = `org0=${query.origin}&dest0=${query.destination}&departureDate0=${query.departureDate}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=TNB`

await browser.goto("http://127.0.0.1:8080/index.html")
await browser.waitFor({
  "ok": { type: "html", html: "abcabcabc" }
}, 30000)

// await browser.goto(`https://www.aircanada.com/aeroplan/redeem/availability/outbound?${paramsText}`)
// const result = await browser.waitFor({
//   "success": { type: "url", url: "*/loyalty/dapidynamic/*/v2/search/air-bounds", statusCode: 200 },
//   "antibotting1": { type: "url", url: "*/aeroplan/redeem/" },
//   "antibotting2": { type: "url", url: "*/loyalty/dapidynamic/*/v2/reward/market-token", statusCode: 403 },
//   "antibotting3": { type: "html", html: "Air Canada's website is not available right now." }
// }, 30000)

// /Applications/Firefox.app/Contents/MacOS/firefox -help
// /Applications/Firefox.app/Contents/MacOS/firefox --remote-debugging-port 9222 --new-instance --profile /tmp/ff-profile
// https://incolumitas.com/2021/05/20/avoid-puppeteer-and-playwright-for-scraping/
// https://embracethered.com/blog/posts/2020/cookies-on-firefox/
