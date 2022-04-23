// @ts-check

/**
 * @param {Object} options
 * @param {import("puppeteer").Page} options.page
 * @param {{origin: string, destination: string, departureDate: string}} options.context
 */
module.exports = async ({ page, context }) => {
  console.log("Going to search page...")

  page.goto(`https://www.united.com/en/us/fsr/choose-flights?f=${context.origin}&t=${context.destination}&d=${context.departureDate}&tt=1&at=1&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&fareWheel=False`)
  const response = await page.waitForResponse("https://www.united.com/api/flight/FetchFlights", { timeout: 10000 })
  /** @type {import("./united").UnitedFetchFlights} */
  const raw = await response.json()

  console.log("Received flights, parsing")
  /** @type {import("../../src/types/scrapers").FlightWithFares[]} */
  const flightsWithFares = []
  if (raw.data.Trips !== null && raw.data.Trips.length > 0) {
    const flights = standardizeResults(raw.data.Trips[0])
    flightsWithFares.push(...flights)
  }

  /** @type {string[]} */
  const warnings = []
  if (raw.Error)
    warnings.push(raw.Error[0])

  console.log("Done.")

  return {
    data: { flightsWithFares, warnings },
    type: "application/json"
  }
}

/**
 * @param {import("./united").Trip} unitedTrip
 */
const standardizeResults = (unitedTrip) => {
  /** @type {import("../../src/types/scrapers").FlightWithFares[]} */
  const results = []
  unitedTrip.Flights.forEach((flight) => {
    /** @type {import("../../src/types/scrapers").FlightWithFares} */
    const result = {
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
      const currencyOfCash = product.Prices.length >= 2 ? product.Prices[1].Currency : ""
      const isSaverFare = product.AwardType === "Saver"

      const cabin = ["economy", "business", "first"].find((checkCabin) => product.Description.toLowerCase().includes(checkCabin))
      if (cabin === undefined)
        return

      let existingFare = result.fares.find((fare) => fare.cabin === cabin)
      if (existingFare) {
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
