import { ScraperMetadata } from "../scraper.js"
import { FlightFare, FlightWithFares, AwardWizQuery, AwardWizScraper } from "../types.js"
import { AAResponse, Slice } from "./samples/aa.js"

export const meta: ScraperMetadata = {
  name: "aa",
  blockUrls: ["cludo.com", "entrust.net", "tiqcdn.com", "cludo.com", "*.go-mpulse.net"],
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  const url = "https://www.aa.com/booking/find-flights"
  void sc.browser.goto(url)
  await sc.browser.waitFor({ "success": { type: "url", url, statusCode: 200 }})

  sc.log("fetching itinerary")
  const fetchRequest = {
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
        "connectionCity": undefined,
        "departureDate": query.departureDate,
        "destination": query.destination,
        "includeNearbyAirports": false,
        "maxStops": undefined,
        "origin": query.origin,
        "departureTime": "040001"
      }],
      "tripOptions": { "locale": "en_US", "searchType": "Award" },
      "loyaltyInfo": undefined
    })
  }

  const cmd = `fetch("https://www.aa.com/booking/api/search/itinerary", ${JSON.stringify(fetchRequest)});`
  void sc.browser.evaluate(cmd)
  const xhrResponse = await sc.browser.waitFor({ "success": { type: "url", url: "https://www.aa.com/booking/api/search/itinerary", statusCode: 200 }})

  sc.log("parsing")
  const json = JSON.parse(xhrResponse.response?.body) as AAResponse
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

const standardizeResults = (slices: Slice[], query: AwardWizQuery): FlightWithFares[] => (
  slices.map((slice) => {
    const segment = slice.segments[0]!
    const leg = segment.legs[0]!
    const result: FlightWithFares = {
      departureDateTime: segment.departureDateTime.replace(" ", "").replace("T", " ").slice(0, 16),
      arrivalDateTime: segment.arrivalDateTime.replace(" ", "").replace("T", " ").slice(0, 16),
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
          cabin: { "COACH": "economy", "PREMIUM_ECONOMY": "economy", "FIRST": "first", "BUSINESS": "business" }[product.productType]!,
          scraper: "aa",
          bookingClass: product.extendedFareCode?.[0]
        }))
        .reduce<FlightFare[]>((lowestCabinFares, fare) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (fare.cabin === undefined)
            throw new Error(`Unknown cabin type on ${segment.flight.carrierCode} ${segment.flight.flightNumber}`)

          const existing = lowestCabinFares.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return lowestCabinFares
          return [...lowestCabinFares.filter((check) => check.cabin !== fare.cabin), fare]
        }, [])
    }

    if (slice.segments.length > 1)
      return
    if (segment.origin.code !== query.origin || segment.destination.code !== query.destination)
      return

    return result
  }).filter((result): result is FlightWithFares => !!result)
)
