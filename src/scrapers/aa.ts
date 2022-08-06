import { FlightFare, FlightWithFares, ScraperQuery } from "../types/scrapers"
import { browserlessInit, gotoPage, log, pptrFetch, Scraper, ScraperMetadata } from "./common"
import type { AAResponse, Slice } from "./samples/aa"

const meta: ScraperMetadata = {
  name: "aa",
  blockUrls: [
    "customer.cludo.com", // "ocsp.entrust.net", "crl.entrust.net", "aia.entrust.net" need blocking at proxy level
  ],
}

export const scraper: Scraper = async (page, query) => {
  await gotoPage(page, "https://www.aa.com/booking/find-flights?redirectSearchToLegacyAACom=false", 5000, "domcontentloaded", 5)

  log("fetching itinerary")
  const raw = await pptrFetch(page, "https://www.aa.com/booking/api/search/itinerary", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9"
    },
    body: JSON.stringify({
      "metadata": { "selectedProducts": [], "tripType": "OneWay", "udo": {} },
      "passengers": [{ "type": "adult", "count": 1 }],
      "queryParams": { "sliceIndex": 0, "sessionId": "", "solutionId": "", "solutionSet": "" },
      "requestHeader": { "clientId": "AAcom" },
      "slices": [{
        "allCarriers": true,
        "cabin": "",
        "connectionCity": null,
        "departureDate": query.departureDate,
        "destination": query.destination,
        "includeNearbyAirports": false,
        "maxStops": null,
        "origin": query.origin,
        "departureTime": "040001"
      }],
      "tripOptions": { "locale": "en_US", "searchType": "Award" },
      "loyaltyInfo": null
    })
  })
  log("parsing")
  const json = JSON.parse(raw) as AAResponse

  if (json.error && json.error !== "309")
    throw new Error(json.error)

  if (json.errorNumber !== 1100) { /* historic date */ }

  const flightsWithFares: FlightWithFares[] = []
  if (json.slices && json.slices.length > 0) {
    const flights = standardizeResults(json.slices, query)
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (slices: Slice[], query: ScraperQuery): FlightWithFares[] => (
  slices.map((slice) => {
    const segment = slice.segments[0]
    const leg = segment.legs[0]
    const result: FlightWithFares = {
      departureDateTime: segment.departureDateTime.replace(" ", "").replace("T", " ").substring(0, 16),
      arrivalDateTime: segment.arrivalDateTime.replace(" ", "").replace("T", " ").substring(0, 16),
      origin: segment.origin.code,
      destination: segment.destination.code,
      flightNo: `${segment.flight.carrierCode} ${segment.flight.flightNumber}`,
      duration: slice.durationInMinutes,
      aircraft: leg.aircraft.name,
      amenities: {
        hasPods: leg.amenities.some((a) => a.includes("lie-flat")),
        hasWiFi: leg.amenities.some((a) => a.includes("wifi"))
      },
      fares: slice.pricingDetail
        .filter((product) => product.productAvailable)
        .map((product): FlightFare => ({
          cash: product.perPassengerTaxesAndFees.amount,
          currencyOfCash: product.perPassengerTaxesAndFees.currency,
          miles: product.perPassengerAwardPoints,
          cabin: { "COACH": "economy", "PREMIUM_ECONOMY": "economy", "FIRST": "business", "BUSINESS": "business" }[product.productType]!,
          scraper: "aa",
          bookingClass: product.extendedFareCode?.[0]
        }))
        .reduce<FlightFare[]>((acc, fare) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (fare.cabin === undefined)
            throw new Error(`Unknown cabin type on ${segment.flight.carrierCode} ${segment.flight.flightNumber}`)

          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, [])
    }

    if (slice.segments.length > 1)
      return undefined
    if (slice.segments[0].origin.code !== query.origin || slice.segments[0].destination.code !== query.destination)
      return undefined

    return result
  }).filter((result): result is FlightWithFares => !!result)
)

module.exports = (params: any) => browserlessInit(meta, scraper, params)
