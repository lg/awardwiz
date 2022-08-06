import type { FlightWithFares } from "../types/scrapers"
import { browserlessInit, log, retry, Scraper, ScraperMetadata } from "./common"
import type { Trip, UnitedResponse } from "./samples/united"

const meta: ScraperMetadata = {
  name: "united",
  blockUrls: [
  ],
}

export const scraper: Scraper = async (page, query) => {
  void retry(5, async () => {
    log("going to flights page")
    await page.goto(`https://www.united.com/en/us/fsr/choose-flights?f=${query.origin}&t=${query.destination}&d=${query.departureDate}&tt=1&at=1&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&fareWheel=False`, { waitUntil: "domcontentloaded", timeout: 25000 }).catch((err) => {
      if (!page.isClosed()) throw err   // if this is a lingering request
    })
    log("completed results page")
  })

  const response = await page.waitForResponse("https://www.united.com/api/flight/FetchFlights", { timeout: 20000 })
  const raw = await response.json() as UnitedResponse

  const flightsWithFares: FlightWithFares[] = []
  if ((raw.data?.Trips || []).length > 0) {
    const flights = standardizeResults(raw.data!.Trips[0])
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (unitedTrip: Trip) => {
  const results: FlightWithFares[] = []
  unitedTrip.Flights.forEach((flight) => {
    const result: FlightWithFares = {
      departureDateTime: `${flight.DepartDateTime}:00`,
      arrivalDateTime: `${flight.DestinationDateTime}:00`,
      origin: flight.Origin,
      destination: flight.Destination,
      flightNo: `${flight.MarketingCarrier} ${flight.FlightNumber}`,
      duration: flight.TravelMinutes,
      aircraft: flight.EquipmentDisclosures.EquipmentDescription,
      fares: [],
      amenities: {
        hasPods: undefined,         // filled in the JSON
        hasWiFi: undefined          // united doesnt return this in its API
      }
    }

    // Make sure we're only getting the airports we requested
    if (flight.Origin !== (unitedTrip.RequestedOrigin || unitedTrip.Origin))
      return
    if (flight.Destination !== (unitedTrip.RequestedDestination || unitedTrip.Destination))
      return

    // United's API has a way of returning flights with more connections than asked
    if (flight.Connections.length > 0)
      return

    // Convert united format to standardized miles and cash formats
    flight.Products.forEach((product) => {
      if (product.Prices.length === 0)
        return

      const miles = product.Prices[0].Amount
      const cash = product.Prices.length >= 2 ? product.Prices[1].Amount : 0
      const currencyOfCash = product.Prices.length >= 2 ? product.Prices[1].Currency : ""
      const bookingClass = product.BookingCode

      const cabin = { "United First": "business", "United Economy": "economy", "United Business": "business", Economy: "economy", Business: "business", First: "first", "United Polaris business": "business", "United Premium Plus": "economy" }[product.Description!]
      if (cabin === undefined)
        throw new Error(`Unknown cabin type: ${product.Description}`)

      let existingFare = result.fares.find((fare) => fare.cabin === cabin)
      if (existingFare !== undefined) {
        if (miles < existingFare.miles)
          existingFare = { ...{ cabin, miles, cash, currencyOfCash, bookingClass, scraper: "united" } }
      } else {
        result.fares.push({ cabin, miles, cash, currencyOfCash, bookingClass, scraper: "united" })
      }
    })

    results.push(result)
  })

  return results
}

module.exports = (params: any) => browserlessInit(meta, scraper, params)
