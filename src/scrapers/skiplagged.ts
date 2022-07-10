// Note this scraper doesnt support business class
// This scraper uses SkipLagged for prices

import { HTTPResponse } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperCapabilities, ScraperFunc } from "../types/scrapers"

type SkipLaggedResponse = typeof import("./extra/skiplagged_sample.json")
type FlightId = keyof SkipLaggedResponse["flights"]
type Flights = Record<FlightId, SkipLaggedResponse["flights"][FlightId]>
type Flight = Flights[FlightId]
type Segment = Flight["segments"][number]

export const capabilities: ScraperCapabilities = {
  missingAttributes: [],
  missingFareAttributes: []
}

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  page.goto(`https://skiplagged.com/flights/${query.origin}/${query.destination}/${query.departureDate}#`)
  const response = await page.waitForResponse((checkResponse: HTTPResponse) => checkResponse.url().startsWith("https://skiplagged.com/api/search.php"))
  const json: SkipLaggedResponse = await response.json()

  const flightsWithFares: FlightWithFares[] = Object.entries(json.flights).map(([id, flight]) => {
    if (flight.count !== 1)
      return undefined
    const segment = flight.segments[0] as Segment

    return {
      departureDateTime: segment.departure.time.replace("T", " ").substring(0, 16),
      arrivalDateTime: segment.arrival.time.replace("T", " ").substring(0, 16),
      origin: segment.departure.airport,
      destination: segment.arrival.airport,
      flightNo: `${segment.airline} ${segment.flight_number}`,
      duration: segment.duration / 60,
      aircraft: "",
      amenities: {
        hasPods: undefined,
        hasWiFi: undefined
      },
      fares: json.itineraries.outbound
        .filter((itinerary) => itinerary.flight === id)
        .map((itinerary) => ({
          cash: itinerary.one_way_price / 100,
          currencyOfCash: "USD",
          miles: 0,
          cabin: "economy",
          scraper: "skiplagged",
          isSaverFare: false
        }))
        .reduce((acc, fare) => {
          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, [] as FlightFare[])
    } as FlightWithFares

  }).filter((flight): flight is FlightWithFares => !!flight)

  return { data: { flightsWithFares } }
}

module.exports = scraper
