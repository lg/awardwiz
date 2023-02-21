import { ScraperMetadata } from "../scraper.js"
import { AwardWizScraper, FlightFare, FlightWithFares } from "../types.js"
import { Segment, SkipLaggedResponse } from "./samples/skiplagged.js"

export const meta: ScraperMetadata = {
  name: "skiplagged"
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  const url = `https://skiplagged.com/api/search.php?from=${query.origin}&to=${query.destination}&depart=${query.departureDate}&return=&format=v3&counts%5Badults%5D=1&counts%5Bchildren%5D=0`
  void sc.browser.goto(url)
  const response = await sc.browser.waitFor({
    "success": { type: "url", url }
  })

  const json = JSON.parse(response.response?.body) as SkipLaggedResponse

  const flightsWithFares: FlightWithFares[] = Object.entries(json.flights).map(([id, flight]) => {
    if (flight.count !== 1 || flight.segments.length !== 1)
      return
    const segment = flight.segments[0]! as Segment

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
