// https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=SFO&dest0=YYZ&departureDate0=2022-06-04

// Notes:
// - domestic flights in "first" are actually business class
// Test:
// - A330|787|777 have pods in Business class (and no First class)

import { HTTPResponse } from "puppeteer"
import { FlightWithFares, ScraperFunc, FlightFare } from "../types/scrapers"
type AeroplanFetchFlights = typeof import("./extra/aeroplan_sample.json")

export const scraper: ScraperFunc = async ({ page, context }) => {
  page.goto(`https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${context.origin}&dest0=${context.destination}&departureDate0=${context.departureDate}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=DOM`)
  const response = await page.waitForResponse((checkResponse: HTTPResponse) => {
    return checkResponse.url() === "https://akamai-gw.dbaas.aircanada.com/loyalty/dapidynamic/1ASIUDALAC/v2/search/air-bounds" && checkResponse.request().method() === "POST"
  }, { timeout: 20000 })
  const raw = await response.json() as AeroplanFetchFlights

  const flightsWithFares: FlightWithFares[] = []
  if (raw.data && raw.data.airBoundGroups !== null && raw.data.airBoundGroups.length > 0) {
    const flights = standardizeResults(raw, context.origin, context.destination)
    flightsWithFares.push(...flights)
  }

  return { data: { flightsWithFares } }
}

const standardizeResults = (raw: AeroplanFetchFlights, origOrigin: string, origDestination: string) => {
  const results: FlightWithFares[] = []
  raw.data.airBoundGroups.forEach((group) => {
    const { flightId } = group.boundDetails.segments[0]
    const flightLookup = raw.dictionaries.flight[flightId as keyof typeof raw.dictionaries.flight]

    const result: FlightWithFares = {
      departureDateTime: flightLookup.departure.dateTime.substring(0, 19).replace("T", " "),
      arrivalDateTime: flightLookup.arrival.dateTime.substring(0, 19).replace("T", " "),
      origin: flightLookup.departure.locationCode,
      destination: flightLookup.arrival.locationCode,
      flightNo: `${flightLookup.marketingAirlineCode} ${flightLookup.marketingFlightNumber}`,
      duration: flightLookup.duration / 60,
      aircraft: raw.dictionaries.aircraft[flightLookup.aircraftCode as keyof typeof raw.dictionaries.aircraft],
      fares: [],
      amenities: {
        hasPods: undefined,
        hasWiFi: undefined  // populated via json from https://www.aircanada.com/aeroplan/redeem/main-es2015.09be3572766daf3ffaa9.js from the aircraftWithWifi variable
      },
    }

    // Skip flights with connections
    if (group.boundDetails.segments.length > 1)
      return

    if (flightLookup.departure.locationCode !== origOrigin || flightLookup.arrival.locationCode !== origDestination)
      return

    const aircraft = raw.dictionaries.aircraft[flightLookup.aircraftCode as keyof typeof raw.dictionaries.aircraft]
    if (!aircraft)
      throw new Error(`Unknown aircraft type: ${flightLookup.aircraftCode}`)

    group.airBounds.forEach((fare) => {
      const cabinShortToCabin: {[x: string]: string} = { eco: "economy", ecoPremium: "economy", business: "business", first: "first" }
      let cabin = cabinShortToCabin[fare.availabilityDetails[0].cabin]
      if (!cabin)
        throw new Error(`Unknown cabin type: ${fare.availabilityDetails[0].cabin}`)

      const { bookingClass } = fare.availabilityDetails[0]

      // Override for United marketing its Business class as First
      if (bookingClass === "I" && flightLookup.marketingAirlineCode === "UA")
        cabin = "economy"

      const fareToAdd: FlightFare = {
        cabin,
        bookingClass,
        miles: fare.prices.milesConversion.convertedMiles.base,
        currencyOfCash: fare.prices.milesConversion.remainingNonConverted.currencyCode,
        cash: Math.ceil(fare.prices.milesConversion.convertedMiles.totalTaxes / 100),
        scraper: "aeroplan"
      }

      // Only keep the lowest fare for each cabin
      const existingForCabin = result.fares.find((f) => f.cabin === fareToAdd.cabin)
      if (existingForCabin) {
        if (fareToAdd.miles < existingForCabin.miles) {
          result.fares = result.fares.filter((f) => f !== existingForCabin)
          result.fares.push(fareToAdd)
        }
      } else {
        result.fares.push(fareToAdd)
      }
    })

    results.push(result)
  })

  return results
}

module.exports = scraper
