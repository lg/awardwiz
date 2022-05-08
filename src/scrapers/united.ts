import { Browser, Page } from "puppeteer"    // eslint-disable-line import/no-extraneous-dependencies
import { FlightWithFares, ScraperQuery, ScraperResults } from "../types/scrapers"
import { Trip, UnitedFetchFlights } from "./united-types"

type BrowserlessQuery = { page: Page, context: ScraperQuery, browser: Browser, timeout: number }
module.exports = async ({ page, context }: BrowserlessQuery): Promise<{ data: ScraperResults }> => {
  console.log("Going to search page...")

  page.goto(`https://www.united.com/en/us/fsr/choose-flights?f=${context.origin}&t=${context.destination}&d=${context.departureDate}&tt=1&at=1&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&fareWheel=False`)
  const response = await page.waitForResponse("https://www.united.com/api/flight/FetchFlights", { timeout: 20000 })
  const raw = await response.json() as UnitedFetchFlights

  console.log("Received flights, parsing")
  const flightsWithFares: FlightWithFares[] = []
  if (raw.data.Trips !== null && raw.data.Trips.length > 0) {
    const flights = standardizeResults(raw.data.Trips[0])
    flightsWithFares.push(...flights)
  }

  const warnings: string[] = []
  if (raw.Error)
    warnings.push(raw.Error[0])

  console.log("Done.")

  return { data: { flightsWithFares, warnings } }
}

const standardizeResults = (unitedTrip: Trip) => {
  const results: FlightWithFares[] = []
  unitedTrip.Flights.forEach((flight) => {
    const result: FlightWithFares = {
      departureDateTime: flight.DepartDateTime,
      arrivalDateTime: flight.DestinationDateTime,
      origin: flight.Origin,
      destination: flight.Destination,
      flightNo: `${flight.MarketingCarrier} ${flight.FlightNumber}`,
      airline: flight.MarketingCarrierDescription,
      duration: flight.TravelMinutes,
      fares: []
    }

    // United's API has a way of returning flights with more connections than asked
    if (flight.Connections.length > 0)
      return

    // Convert united format to standardized miles and cash formats
    flight.Products.forEach((product) => {
      if (product.Prices.length === 0)
        return

      const miles = product.Prices[0].Amount
      const cash = product.Prices.length >= 2 ? product.Prices[1].Amount : 0
      const currencyOfCash = product.Prices.length >= 2 ? (product.Prices[1].Currency ?? "") : ""
      const isSaverFare = product.AwardType === "Saver"

      const cabin = ["economy", "business", "first"].find((checkCabin) => product.Description?.toLowerCase().includes(checkCabin))
      if (cabin === undefined)
        return

      let existingFare = result.fares.find((fare) => fare.cabin === cabin)
      if (existingFare !== undefined) {
        if (miles < existingFare.miles)
          existingFare = { ...{ cabin, miles, cash, currencyOfCash, isSaverFare } }
      } else {
        result.fares.push({ cabin, miles, cash, currencyOfCash, isSaverFare })
      }
    })

    results.push(result)
  })

  return results
}
