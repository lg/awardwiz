// Note this scraper doesnt support business class
// This scraper uses SkipLagged for prices

import { HTTPResponse } from "puppeteer"
import type { FlightFare, FlightWithFares } from "../types/scrapers"
import { browserlessInit, BrowserlessInput, gotoPageAndWaitForResponse, Scraper, ScraperMetadata } from "./common"
import type { SkipLaggedResponse, Segment } from "./samples/skiplagged"

const meta: ScraperMetadata = {
  name: "skiplagged",
  blockUrls: ["www.gstatic.com", "/img/", "api/user_info.php", "flex.php"],
}

export const scraper: Scraper = async (page, query) => {
  const response = await gotoPageAndWaitForResponse({ page,
    url: `https://skiplagged.com/flights/${query.origin}/${query.destination}/${query.departureDate}`,
    waitForResponse: (checkResponse: HTTPResponse) => checkResponse.url().startsWith("https://skiplagged.com/api/search.php")
  })

  const json: SkipLaggedResponse = await response.json()

  const flightsWithFares: FlightWithFares[] = Object.entries(json.flights).map(([id, flight]) => {
    if (flight.count !== 1 || flight.segments.length !== 1)
      return
    const segment = flight.segments[0] as Segment

    return {
      departureDateTime: segment.departure.time.replace("T", " ").slice(0, 16),
      arrivalDateTime: segment.arrival.time.replace("T", " ").slice(0, 16),
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
        .reduce<FlightFare[]>((bestForCabin, fare) => {
          const existing = bestForCabin.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return bestForCabin
          return [...bestForCabin.filter((check) => check.cabin !== fare.cabin), fare]
        }, [])
    } as FlightWithFares

  }).filter((flight): flight is FlightWithFares => !!flight)

  return flightsWithFares
}

module.exports = (input: BrowserlessInput) => browserlessInit(meta, scraper, input)
