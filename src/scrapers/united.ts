import type { FlightWithFares } from "../types/scrapers"
import { browserlessInit, BrowserlessInput, gotoPage, log, processScraperFlowRules, Scraper, ScraperMetadata } from "./common"
import type { Trip, UnitedResponse } from "./samples/united"

const meta: ScraperMetadata = {
  name: "united",
  noBlocking: true
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
  ].sort((a, b) => Math.random() - 0.5), true)

  await processScraperFlowRules(page, [
    { find: "button[class~='atm-u-margin-top-large']", done: true },
  ])

  log("waiting for results")
  const fetchFlights = page.waitForResponse("https://www.united.com/api/flight/FetchFlights", { timeout: 10000 })
    .then(async (rawResponse) => {
      const responseText = await rawResponse.text()
      if (responseText.includes("<H1>Access Denied</H1>"))
        throw new Error("Access Denied for FetchFlights")
      return JSON.parse(responseText) as UnitedResponse
    })

  const errorResponse = page.waitForSelector(".atm-c-alert--error .atm-c-btn__text")
    .then((item) => (item?.evaluate((node) => node.textContent ?? undefined)))
    .catch(() => undefined)
  const response = await Promise.race([fetchFlights, errorResponse])

  if (response === undefined || typeof response === "string") {
    if (response?.includes("the airport is not served"))  // invalid airport code
      return []
    throw new Error(`Error fetching flights: ${response ?? "unknown"}`)
  }

  log("parsing results")
  const flightsWithFares: FlightWithFares[] = []
  if ((response.data?.Trips || []).length > 0) {
    const flights = standardizeResults(response.data!.Trips[0])
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (unitedTrip: Trip) => {
  const results: FlightWithFares[] = []
  for (const flight of unitedTrip.Flights) {
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
      continue
    if (flight.Destination !== (unitedTrip.RequestedDestination || unitedTrip.Destination))
      continue

    // United's API has a way of returning flights with more connections than asked
    if (flight.Connections.length > 0)
      continue

    // Convert united format to standardized miles and cash formats
    for (const product of flight.Products) {
      if (product.Prices.length === 0)
        continue

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
          existingFare = { cabin, miles, cash, currencyOfCash, bookingClass, scraper: "united" }
      } else {
        result.fares.push({ cabin, miles, cash, currencyOfCash, bookingClass, scraper: "united" })
      }
    }

    results.push(result)
  }

  return results
}

module.exports = (input: BrowserlessInput) => browserlessInit(meta, scraper, input)
