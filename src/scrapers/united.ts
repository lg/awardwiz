import { gotoPage, waitForJsonSuccess } from "../common.js"
import { AwardWizQuery, AwardWizScraper, FlightWithFares } from "../types.js"
import type { Trip, UnitedResponse } from "./samples/united.js"
import c from "ansi-colors"
import { ScraperMetadata } from "../scraper.js"

export const meta: ScraperMetadata = {
  name: "united",
  blockUrls: [
    "*.liveperson.net", "tags.tiqcdn.com",
    "https://www.united.com/api/airports/lookup/?airport=*" /* needed since we don't want dropdowns */ ],
  forceCacheUrls: [
    "*.svg", "*/npm.*", "*/fonts/*", "*.chunk.js", "*/runtime.*.js", "*/manifest.json", "*/api/home/advisories",
    "*/api/referenceData/messages/*", "*/api/referencedata/nearestAirport/*",
    "*/api/User/IsEmployee", "*/api/flight/recentSearch"]
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  await gotoPage(sc, "https://www.united.com/en/us/book-flight/united-one-way", "networkidle")

  await sc.page.locator("label").filter({ hasText: "Miles" }).click()

  await sc.page.getByLabel("From").fill(query.origin)   // we block the as-you-type requests
  await sc.page.getByRole("combobox", { name: "Enter your destination city, airport name, or airport code." }).fill(query.destination)

  await sc.page.getByPlaceholder("Depart").fill(query.departureDate)
  const acceptedDate = await sc.page.getByPlaceholder("Depart").inputValue()
  if (acceptedDate === query.departureDate) {
    sc.log(c.yellow(`WARN: Departure date ${query.departureDate} not accepted`))
    return []
  }

  sc.page.getByRole("button", { name: "Find flights" }).click().catch(() => {})   // async

  sc.log("waiting for results")
  sc.page.setDefaultTimeout(60000)  // TODO: this isn't great

  const fetchFlights = await waitForJsonSuccess<UnitedResponse>(sc, "https://www.united.com/api/flight/FetchFlights", {
    "invalid airport": sc.page.getByRole("link", { name: "Either the information you entered is not valid or the airport is not served by United or our partners. Please revise your entry." })
  })
  if (typeof fetchFlights === "string") {
    sc.log(c.yellow(`WARN: ${fetchFlights}`))
    return []
  }

  sc.log("parsing results")
  const flightsWithFares: FlightWithFares[] = []
  if ((fetchFlights.data?.Trips || []).length) {
    const flights = standardizeResults(query, fetchFlights.data!.Trips[0]!)
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (query: AwardWizQuery, unitedTrip: Trip) => {
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
    if (result.departureDateTime.substring(0, 10) !== query.departureDate.substring(0, 10))
      continue

    // United's API has a way of returning flights with more connections than asked
    if (flight.Connections.length > 0)
      continue

    // Convert united format to standardized miles and cash formats
    for (const product of flight.Products) {
      if (product.Prices.length === 0)
        continue

      const miles = product.Prices[0]!.Amount
      const cash = product.Prices.length >= 2 ? product.Prices[1]!.Amount : 0
      const currencyOfCash = product.Prices.length >= 2 ? product.Prices[1]!.Currency : ""
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