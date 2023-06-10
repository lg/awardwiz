import { AwardWizQuery, AwardWizScraper, FlightWithFares } from "../awardwiz-types.js"
import type { Trip, UnitedResponse } from "../scraper-types/united.js"
import { ScraperMetadata } from "../../arkalis/arkalis.js"

export const meta: ScraperMetadata = {
  name: "united",
  blockUrls: ["liveperson.net", "tags.tiqcdn.com"],
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  const url = `https://www.united.com/en/us/fsr/choose-flights?f=${query.origin}&t=${query.destination}&d=${query.departureDate}&tt=1&at=1&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&tqp=A`
  arkalis.goto(url)

  arkalis.log("waiting for results")
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "https://www.united.com/api/flight/FetchFlights", onlyStatusCode: 200, othersThrow: true },
    "invalid airport": { type: "html", html: "you entered is not valid or the airport is not served" },
    "invalid input": { type: "html", html: "We can't process this request. Please restart your search." },
    "anti-botting": { type: "html", html: "united.com was unable to complete" },
  })
  if (waitForResult.name !== "success") {
    if (waitForResult.name === "anti-botting")
      throw new Error(waitForResult.name)
    return arkalis.warn(waitForResult.name)
  }
  const fetchFlights = JSON.parse(waitForResult.response!.body) as UnitedResponse

  arkalis.log("parsing results")
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
        throw new Error(`Unknown cabin type: ${product.Description!}`)

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