import { FlightFare, FlightWithFares, ScraperCapabilities, ScraperFunc, ScraperQuery } from "../types/scrapers"
import { isSaver, pptrFetch } from "./common"

export const capabilities: ScraperCapabilities = {
  missingAttributes: [],
  missingFareAttributes: []
}

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  await page.goto("https://www.aa.com/booking/find-flights?redirectSearchToLegacyAACom=false")
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
  const json = JSON.parse(raw) as typeof import("./extra/aa_sample.json")

  if (json.error)
    throw new Error(json.error)

  const flightsWithFares: FlightWithFares[] = []
  if (json.slices && json.slices.length > 0) {
    const flights = standardizeResults(json.slices, query)
    flightsWithFares.push(...flights)
  }

  return { data: { flightsWithFares } }
}

const standardizeResults = (slices: typeof import("./extra/aa_sample.json")["slices"], query: ScraperQuery): FlightWithFares[] => (
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
        hasPods: leg.amenities.some((a) => a.indexOf("lie-flat") > -1),
        hasWiFi: leg.amenities.some((a) => a.indexOf("wifi") > -1)
      },
      fares: slice.pricingDetail
        .filter((product) => product.productAvailable)
        .map((product) => ({
          cash: product.perPassengerTaxesAndFees.amount,
          currencyOfCash: product.perPassengerTaxesAndFees.currency,
          miles: product.perPassengerAwardPoints,
          cabin: { "COACH": "economy", "PREMIUM_ECONOMY": "economy", "FIRST": "business", "BUSINESS": "business" }[product.productType]!,
          scraper: "aa",
          isSaverFare: isSaver(segment.flight.carrierCode, product.extendedFareCode)
        }))
        .reduce((acc, fare) => {
          if (fare.cabin === undefined)
            throw new Error(`Unknown cabin type on ${segment.flight.carrierCode} ${segment.flight.flightNumber}`)

          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, [] as FlightFare[])
    }

    if (slice.segments.length > 1)
      return undefined
    if (slice.segments[0].origin.code !== query.origin || slice.segments[0].destination.code !== query.destination)
      return undefined

    return result
  }).filter((result) => !!result) as FlightWithFares[]
)

module.exports = scraper
