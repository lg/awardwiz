// import dayjs from "dayjs"
import { ScraperMetadata } from "../scraper.js"
import { AwardWizScraper, FlightFare, FlightWithFares } from "../types.js"
import { DeltaResponse } from "./samples/delta.js"
// import c from "ansi-colors"

export const meta: ScraperMetadata = {
  name: "delta",
  blockUrls: [
    "yahoo.com", "google.com", "facebook.com", "facebook.net", "pinterest.com", "bing.com", "t.co", "twitter.com",
    "doubleclick.net", "adservice.google.com", "trackjs.com", "quantummetric.com", "foresee.com",
    "dynatrace-managed.com", "demdex.net", "criteo.com", "go-mpulse.net", "flashtalking.com",

    // risky
    // "deltaairlines.tt.omtrdc.net",
    // "tms.delta.com", "smetrics.delta.com"]
  ]

  // forceCacheUrls: ["*/predictivetext/getPredictiveCities?code=*", "*/flight-search/getdevicetype",
  //   "*/custlogin/getDashBrdData.action", "*/databroker/bcdata.action"],
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  sc.browser.goto("http://127.0.0.1:8000/?a=5")
  await sc.browser.client["Page.loadEventFired"]()
  sc.log("loaded")

  await sc.browser.mouseKeyboard.clickSelector("#btn")
  await sc.browser.mouseKeyboard.clickSelector("#btn2")
  // eslint-disable-next-line no-restricted-globals
  await new Promise(resolve => setTimeout(resolve, 100000))



  // await sc.browser.client.Fetch.enable({ patterns: [{ urlPattern: "https://www.delta.com/prefill/retrieveSearch?searchType=RecentSearchesJSON*" }] })
  // sc.browser.client.Fetch.requestPaused(async (params) => {
  //   return sc.browser.client.Fetch.fulfillRequest({ requestId: params.requestId, responseCode: 200, body:
  //     Buffer.from(JSON.stringify(
  //       [{
  //         "airports": {
  //           "fromCity": `${query.origin}`,
  //           "toCity": `${query.destination}`,
  //           "fromAirportcode": `${query.origin}`,
  //           "toAirportcode": `${query.destination}`,
  //           "fromStateCode": "",
  //           "toStateCode": ""
  //         },
  //         "selectTripType": "ONE_WAY", "dates": { "departureDate": "03/01/2023", "returnDate": "" },
  //         "passenger": "1", "swapedFromCity": "null", "swapedToCity": "null", "schedulePrice": { "value": "miles" },
  //         "faresFor": "BE", "meetingEventCode": "", "refundableFlightsOnly": false, "nearbyAirports": false,
  //         "deltaOnly": "off", "awardTravel": true, "departureTime": "AT", "returnTime": "AT", "infantCount": 0,
  //         "adtCount": 0, "cnnCount": 0, "gbeCount": 0,
  //       }]
  //     )).toString("base64")
  //  })
  // })

  // void sc.browser.goto("https://www.delta.com/flight-search/book-a-flight")
  // await sc.browser.waitFor({ "success": { type: "url", url: "https://www.delta.com/prefill/retrieveSearch?searchType=RecentSearchesJSON*", statusCode: 200 }})




  //await sc.browser.client.Input.
  //await sc.browser.client.Input.dispatchMouseEvent({ type: "mouseMoved", x: 0, y: 0 })



  // sc.log("unchecking flex")
  // await new Promise((resolve) => setTimeout(resolve, 100))
  // await sc.browser.evaluate("document.querySelector('#chkFlexDate').checked = false")
  //sc.log("clicking search")
  //await sc.browser.evaluate("document.querySelector('#btnSubmit').click()")




  // void sc.browser.goto("https://www.delta.com")

//////////

  // const url = "https://www.delta.com/flight-search/book-a-flight"
  // void sc.browser.goto(url)
  // await sc.browser.waitFor({ "success": { type: "url", url, statusCode: 200 }})

  // sc.log("fetching itinerary")
  // const fetchRequest = {
  //   credentials: "include",
  //   headers: {
  //     "Accept": "application/json",
  //     "Accept-Language": "en-US,en;q=0.5",
  //     "Content-Type": "application/json; charset=utf-8",
  //   },
  //   "body": JSON.stringify({
  //     "tripType": "ONE_WAY",
  //     "shopType": "MILES", "priceType": "Award", "nonstopFlightsOnly": "false", "bookingPostVerify": "RTR_YES", "bundled": "off", "segments": [{ "origin": query.origin, "destination": query.destination, "departureDate": query.departureDate, "connectionAirportCode": null }], "destinationAirportRadius": { "measure": 100, "unit": "MI" }, "originAirportRadius": { "measure": 100, "unit": "MI" }, "flexAirport": false, "flexDate": false, "flexDaysWeeks": "", "passengers": [{ "count": "1", "type": "ADT" }], "meetingEventCode": "", "bestFare": "BE", "searchByCabin": true, "cabinFareClass": null, "refundableFlightsOnly": false, "deltaOnlySearch": "false", "initialSearchBy": { "fareFamily": "BE", "cabinFareClass": null, "meetingEventCode": "", "refundable": false, "flexAirport": false, "flexDate": false, "flexDaysWeeks": "" }, "searchType": "search", "searchByFareClass": null, "pageName": "FLIGHT_SEARCH", "requestPageNum": "1", "action": "findFlights", "actionType": "", "priceSchedule": "AWARD", "schedulePrice": "miles", "shopWithMiles": "on", "awardTravel": "true", "datesFlexible": false, "flexCalendar": false, "upgradeRequest": false, "is_Flex_Search": true, "filter": null }),
  //   "method": "POST",
  // }

  // const cmd = `fetch(https://www.delta.com/shop/ow/search", ${JSON.stringify(fetchRequest)});`
  // void sc.browser.evaluate(cmd)
  // const xhrResponse = await sc.browser.waitFor({ "success": { type: "url", url: "https://www.delta.com/shop/ow/search", statusCode: 200 }})
  // debugger


// await fetch("https://www.delta.com/shop/ow/search", {
//     "credentials": "include",
//     "headers": {
//         "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0",
//         "Accept": "application/json",
//         "Accept-Language": "en-US,en;q=0.5",
//         "Content-Type": "application/json; charset=utf-8",
//         "X-APP-CHANNEL": "sl-sho",
//         "X-APP-ROUTE": "SL-RSB",
//         "X-APP-REFRESH": "",
//         "CacheKey": "6d71b170-d7fb-4ef8-b2ab-219badfbb815",
//         "Sec-Fetch-Dest": "empty",
//         "Sec-Fetch-Mode": "cors",
//         "Sec-Fetch-Site": "same-origin",
//         "Pragma": "no-cache",
//         "Cache-Control": "no-cache"
//     },
//     "referrer": "https://www.delta.com/flight-search/search-results?cacheKeySuffix=6d71b170-d7fb-4ef8-b2ab-219badfbb815",
//     "body": "{"tripType":"ONE_WAY","shopType":"MILES","priceType":"Award","nonstopFlightsOnly":"false","bookingPostVerify":"RTR_YES","bundled":"off","segments":[{"origin":"LAX","destination":"SFO","departureDate":"2023-03-23","connectionAirportCode":null}],"destinationAirportRadius":{"measure":100,"unit":"MI"},"originAirportRadius":{"measure":100,"unit":"MI"},"flexAirport":false,"flexDate":false,"flexDaysWeeks":"","passengers":[{"count":"1","type":"ADT"}],"meetingEventCode":"","bestFare":"BE","searchByCabin":true,"cabinFareClass":null,"refundableFlightsOnly":false,"deltaOnlySearch":"false","initialSearchBy":{"fareFamily":"BE","cabinFareClass":null,"meetingEventCode":"","refundable":false,"flexAirport":false,"flexDate":false,"flexDaysWeeks":""},"searchType":"search","searchByFareClass":null,"pageName":"FLIGHT_SEARCH","requestPageNum":"1","action":"findFlights","actionType":"","priceSchedule":"AWARD","schedulePrice":"miles","shopWithMiles":"on","awardTravel":"true","datesFlexible":false,"flexCalendar":false,"upgradeRequest":false,"is_Flex_Search":true,"filter":null}",
//     "method": "POST",
//     "mode": "cors"
// });






/////////

  //await new Promise(r => setTimeout(r, 100000))
  //await sc.pause()

  // await gotoPage(sc, "https://www.delta.com/flight-search/book-a-flight", "load")

  // const shopWithMiles = async () => {
  //   sc.log("selecting miles")
  //   await sc.page.locator("label").filter({ hasText: "Shop with Miles" }).click()
  // }

  // const oneWay = async () => {
  //   sc.log("selecting oneway")
  //   await sc.page.getByRole("combobox", { name: "Trip Type:, changes will reload the page" }).getByText("Round Trip").click()
  //   await sc.page.getByRole("option", { name: "One Way" }).click()
  // }

  // const origin = async () => {
  //   sc.log("selecting origin")
  //   await sc.page.getByRole("link", { name: "From Departure Airport or City Your Origin" }).click()
  //   await sc.page.getByRole("textbox", { name: "Origin City or Airport" }).fill(query.origin)
  //   const resultOrigin = await Promise.race([
  //     sc.page.getByRole("link", { name: new RegExp(`${query.origin} .+,\\s.*`, "g") }).click().then(() => "ok").catch(() => "not found"),
  //     sc.page.locator("#resultStatus").getByText("No search result").waitFor().then(() => "not found").catch(() => "not found")
  //   ])
  //   if (resultOrigin === "not found") { sc.log(c.yellow("WARN: origin not found")) ; return [] }
  //   return
  // }

  // const destination = async () => {
  //   sc.log("selecting destination")
  //   await sc.page.getByRole("link", { name: "To Destination Airport or City Your Destination" }).click()
  //   await sc.page.getByRole("textbox", { name: "Destination City or Airport" }).fill(query.destination)
  //   const resultDestination = await Promise.race([
  //     sc.page.getByRole("link", { name: new RegExp(`${query.destination} .+,\\s.*`, "g") }).click().then(() => "ok").catch(() => "not found"),
  //     sc.page.locator("#resultStatus").getByText("No search result").waitFor().then(() => "not found").catch(() => "not found")
  //   ])
  //   if (resultDestination === "not found") { sc.log(c.yellow("WARN: destination not found")) ; return [] }
  //   return
  // }

  // const selectDate = async () => {
  //   sc.log("selecting date")
  //   await sc.page.getByRole("button", { name: "Depart and Return Calendar Use enter to open" }).click()

  //   const formattedDate = dayjs(query.departureDate).format("D MMMM YYYY, dddd")
  //   let monthDate = dayjs()
  //   await sc.page.getByText(monthDate.format("MMMMYYYY")).waitFor()     // calendar should appear
  //   monthDate = monthDate.add(1, "month")
  //   await sc.page.getByText(monthDate.format("MMMMYYYY")).waitFor()     // should be instant

  //   while (!await sc.page.getByRole("link", { name: formattedDate }).waitFor({timeout: 100}).then(() => true).catch(() => false)) {
  //     await sc.page.getByRole("link", { name: "Next" }).click()
  //     monthDate = monthDate.add(1, "month")
  //     await sc.page.getByText(monthDate.format("MMMMYYYY")).waitFor()
  //   }
  //   await sc.page.getByRole("link", { name: formattedDate }).click()
  //   await sc.page.getByRole("button", { name: "done" }).click()
  // }

  // for (const step of [shopWithMiles, oneWay, origin, destination, selectDate].sort((a, b) => Math.random() - 0.5)) {
  //   const result = await step()
  //   if (Array.isArray(result)) return result
  // }

  // // submit and skip past interstitial page
  // sc.log("submitting search")
  // sc.page.locator("#btnSubmit").first().click().catch(() => {})    // async

  // sc.log("waiting for interstitial page")
  // const result = await waitFor(sc, {
  //   "no flights": sc.page.locator("td.selected .naText"),
  //   "no flights2": sc.page.getByText("no results were found for your search"),
  //   "ok": sc.page.getByRole("button", { name: "Continue" }).click(),
  //   "pre-interstitial anti-botting": sc.page.waitForResponse("https://www.delta.com/content/www/en_US/system-unavailable1.html")
  // })
  // if (result === "no flights" || result === "no flights2")
  //   return []
  // if (result !== "ok")
  //   throw new Error(result)

  // // clicked the continue button on the interstitial page, now wait for search results
  // sc.log("waiting for search results")
  // const searchResults = await waitForJsonSuccess<DeltaResponse>(sc, "https://www.delta.com/shop/ow/search", {
  //   "system unavailable anti-botting": sc.page.waitForResponse("https://www.delta.com/content/www/en_US/system-unavailable1.html"),
  //   "back to search anti-botting": sc.page.getByRole("heading", { name: "BOOK A FLIGHT" })
  // })
  // if (typeof searchResults === "string")
  //   throw new Error(searchResults)

  // sc.log("finished getting results, parsing")
  // const flightsWithFares: FlightWithFares[] = []
  // if (searchResults.itinerary.length > 0) {
  //   const flights = standardizeResults(searchResults)
  //   flightsWithFares.push(...flights)
  // }

  // return flightsWithFares
  return []
}

// eslint-disable-next-line no-unused-vars
const standardizeResults = (raw: DeltaResponse) => {
  const results: FlightWithFares[] = []
  for (const itinerary of raw.itinerary) {
    const trip = itinerary.trip[0]!
    const segment = trip.flightSegment[0]!

    const result: FlightWithFares = {
      departureDateTime: trip.schedDepartLocalTs.replace("T", " "),
      arrivalDateTime: trip.schedArrivalLocalTs.replace("T", " "),
      origin: trip.originAirportCode,
      destination: trip.destAirportCode,
      flightNo: `${segment.marketingCarrier.code} ${segment.marketingFlightNum}`,
      duration: segment.totalAirTime.day * 24 * 60 + segment.totalAirTime.hour * 60 + segment.totalAirTime.minute,
      aircraft: segment.flightLeg[0]?.aircraft.fleetName,
      fares: trip.viewSeatUrls[0]!.fareOffer.itineraryOfferList
        .filter((offer) => !offer.soldOut && offer.offered)
        .map((offer) => ({
          cash: offer.totalPrice?.currency?.amount ?? -1,
          currencyOfCash: offer.totalPrice?.currency?.code ?? "USD",
          miles: offer.totalPrice?.miles?.miles ?? 0,
          cabin: offer.brandInfoByFlightLegs[0]!.cos[0] === "O" ? "business" : "economy",
          scraper: "delta",
          bookingClass: offer.brandInfoByFlightLegs[0]!.cos
        }))
        .filter((fare) => fare.cash !== -1 && fare.miles !== 0)
        .reduce<FlightFare[]>((bestForCabin, fare) => {
          const existing = bestForCabin.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return bestForCabin
          return [...bestForCabin.filter((check) => check.cabin !== fare.cabin), fare]
        }, []),
      amenities: {
        hasPods: trip.summarizedProducts.some((product) => product.productIconId === "fla") || (segment.marketingCarrier.code === "DL" ? false : undefined),
        hasWiFi: trip.summarizedProducts.some((product) => product.productIconId === "wif") || (segment.marketingCarrier.code === "DL" ? false : undefined),
      }
    }

    if (trip.flightSegment.length > 1)
      continue
    if (trip.originAirportCode !== raw.tripOriginAirportCode || trip.destAirportCode !== raw.tripDestinationAirportCode)
      continue

    results.push(result)
  }

  return results
}
