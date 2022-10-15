import type { FlightWithFares } from "../types/scrapers"
import { browserlessInit, gotoPage, log, processScraperFlowRules, Scraper, ScraperMetadata } from "./common"
import type { Trip, UnitedResponse } from "./samples/united"

const meta: ScraperMetadata = {
  name: "united"
}

export const scraper: Scraper = async (page, query) => {
  log("going to search page")
  await gotoPage(page, "https://www.united.com/en/us/book-flight/united-one-way", "networkidle2")

  log("inputting search")
  await processScraperFlowRules(page, [
    { find: "label[for='bookingTypeMile22']", andWaitFor: "label[for='bookingTypeMile22'].atm-c-toggle__label--checked" },
    { find: "input#originInput5", type: query.origin },
    { find: "input#destinationInput6", type: query.destination },
    { find: "input#DepartDate", type: query.departureDate },
    { find: "button[class~='atm-u-margin-top-large']", done: true },
  ])

  log("waiting for results")
  const flightsResponse = await page.waitForResponse("https://www.united.com/api/flight/FetchFlights")
    .then((rawResponse) => rawResponse.json() as Promise<UnitedResponse>)

  log("parsing results")
  const flightsWithFares: FlightWithFares[] = []
  if ((flightsResponse.data?.Trips || []).length > 0) {
    const flights = standardizeResults(flightsResponse.data!.Trips[0])
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
