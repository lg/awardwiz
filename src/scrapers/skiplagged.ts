// Note this scraper doesnt support business class
// This scraper uses SkipLagged for prices

import { HTTPResponse } from "puppeteer"
import type { FlightFare, FlightWithFares, ScraperFunc } from "../types/scrapers"
import type { SkipLaggedResponse, Segment } from "./samples/skiplagged"

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  page.goto(`https://skiplagged.com/flights/${query.origin}/${query.destination}/${query.departureDate}#`)
  const response = await page.waitForResponse((checkResponse: HTTPResponse) => checkResponse.url().startsWith("https://skiplagged.com/api/search.php"))
  const json: SkipLaggedResponse = await response.json()

  const flightsWithFares: FlightWithFares[] = Object.entries(json.flights).map(([id, flight]) => {
    if (flight.count !== 1 || flight.segments.length !== 1)
      return undefined
    const segment = flight.segments[0] as Segment

    return {
      departureDateTime: segment.departure.time.replace("T", " ").substring(0, 16),
      arrivalDateTime: segment.arrival.time.replace("T", " ").substring(0, 16),
      origin: segment.departure.airport,
      destination: segment.arrival.airport,
      flightNo: `${segment.airline} ${segment.flight_number}`,
      duration: segment.duration / 60,
      aircraft: undefined,
      amenities: {
        hasPods: undefined,
        hasWiFi: undefined
      },
      fares: json.itineraries.outbound
        .filter((itinerary) => itinerary.flight === id)
        .map((itinerary): FlightFare => ({
          cash: itinerary.one_way_price / 100,
          currencyOfCash: "USD",
          miles: 0,
          cabin: "economy",
          scraper: "skiplagged",
          bookingClass: undefined
        }))
        .reduce<FlightFare[]>((acc, fare) => {
          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, [])
    } as FlightWithFares

  }).filter((flight): flight is FlightWithFares => !!flight)

  return { data: { flightsWithFares } }
}

module.exports = scraper
