import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { FlightFare, FlightWithFares, AwardWizQuery, AwardWizScraper } from "../awardwiz-types.js"
import { AlaskaResponse } from "../scraper-types/alaska.js"

export const meta: ScraperMetadata = {
  name: "alaska",
  blockUrls: [
    "cdn.appdynamics.com", "*.siteintercept.qualtrics.com", "dc.services.visualstudio.com",
    "js.adsrvr.org", "siteintercept.qualtrics.com", "bing.com", "tiktok.com", "www.googletagmanager.com", "facebook.net",
    "demdex.net", "cdn.uplift-platform.com", "contentcdnprodacct.blob.core.windows.net", "doubleclick.net",
    "www.google-analytics.com", "collect.tealiumiq.com", "alaskaair-app.quantummetric.com", "facebook.com",
    "rl.quantummetric.com", "app.securiti.ai", "cdn.optimizely.com"
  ],
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  const url = `https://www.alaskaair.com/searchbff/V3/search?origins=${query.origin}&destinations=${query.destination}&dates=${query.departureDate}&numADTs=1&fareView=as_awards&sessionID=&solutionSetIDs=&solutionIDs=`
  arkalis.goto(url)
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "https://www.alaskaair.com/searchbff/V3/search*", onlyStatusCode: 200, othersThrow: true },
  })
  if (waitForResult.name !== "success")
    throw new Error(waitForResult.name)
  const fetchFlights = JSON.parse(waitForResult.response!.body) as AlaskaResponse
  if (!fetchFlights.slices)
    return arkalis.warn("No scheduled flights between cities")

  arkalis.log("parsing results")
  const results = standardizeResults(fetchFlights, query)
  return results
}

const standardizeResults = (raw: AlaskaResponse, query: AwardWizQuery): FlightWithFares[] => {
  const results: FlightWithFares[] = []
  for (const slice of raw.slices!) {
    if (slice.segments.length > 1)
      continue
    const segment = slice.segments[0]!

    const result: FlightWithFares = {
      departureDateTime: segment.departureTime.slice(0, 19).replace("T", " "),
      arrivalDateTime: segment.arrivalTime.slice(0, 19).replace("T", " "),
      origin: segment.departureStation,
      destination: segment.arrivalStation,
      flightNo: `${segment.publishingCarrier.carrierCode} ${segment.publishingCarrier.flightNumber}`,
      duration: segment.duration,
      aircraft: segment.aircraft,
      fares: [],
      amenities: {
        hasPods: undefined,
        hasWiFi: segment.amenities.includes("Wi-Fi"),
      },
    }

    if (result.origin !== query.origin || result.destination !== query.destination)
      continue

    for (const fare of Object.values(slice.fares)) {
      if (fare.bookingCodes.length !== 1)
        throw new Error(`multiple booking codes\n${JSON.stringify(fare, null, 2)}}`)
      if (fare.cabins.length !== 1)
        throw new Error(`multiple cabins\n${JSON.stringify(fare, null, 2)}}`)
      if (fare.cabins[0] !== "MAIN" && fare.cabins[0] !== "FIRST" && fare.cabins[0] !== "SAVER" && fare.cabins[0] !== "COACH" && fare.cabins[0] !== "BUSINESS")
        throw new Error(`unknown cabin: ${fare.cabins[0]!}\n${JSON.stringify(fare, null, 2)}}`)

      const fareToAdd: FlightFare = {
        bookingClass: fare.bookingCodes[0],
        cabin: {"FIRST": "business", "MAIN": "economy", "SAVER": "economy", "COACH": "economy", "BUSINESS": "business"}[fare.cabins[0]!]!,
        cash: fare.grandTotal,
        currencyOfCash: "USD",
        miles: fare.milesPoints,
        scraper: "alaska",
        isSaverFare: fare.cabins[0] === "SAVER",
      }

      // Only keep the lowest fare for each cabin
      const existingForCabin = result.fares.find((f) => f.cabin === fareToAdd.cabin)
      if (existingForCabin) {
        if (fareToAdd.miles < existingForCabin.miles) {
          result.fares = result.fares.filter((f) => f !== existingForCabin)
          result.fares.push(fareToAdd)
        }
      } else {
        result.fares.push(fareToAdd)
      }
    }

    results.push(result)
  }

  return results
}
