// https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=SFO&dest0=YYZ&departureDate0=2022-06-04

import { HTTPResponse } from "puppeteer"
import { FlightWithFares, ScraperCapabilities, ScraperFunc, FlightFare } from "../types/scrapers"
import { AeroplanFetchFlights } from "./aeroplan-types"

export const capabilities: ScraperCapabilities = {
  missingAttributes: ["hasWifi"],
  missingFareAttributes: []
}

export const scraper: ScraperFunc = async ({ page, context }) => {
  page.goto(`https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${context.origin}&dest0=${context.destination}&departureDate0=${context.departureDate}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=DOM`)
  const response = await page.waitForResponse((checkResponse: HTTPResponse) => {
    return checkResponse.url() === "https://akamai-gw.dbaas.aircanada.com/loyalty/dapidynamic/1ASIUDALAC/v2/search/air-bounds" && checkResponse.request().method() === "POST"
  }, { timeout: 20000 })
  const raw = await response.json() as AeroplanFetchFlights

  const flightsWithFares: FlightWithFares[] = []
  if (raw.data && raw.data.airBoundGroups !== null && raw.data.airBoundGroups.length > 0) {
    const flights = standardizeResults(raw)
    flightsWithFares.push(...flights)
  }

  return { data: { flightsWithFares } }
}

const standardizeResults = (raw: AeroplanFetchFlights) => {
  const results: FlightWithFares[] = []
  raw.data.airBoundGroups.forEach((group) => {
    const { flightId } = group.boundDetails.segments[0]
    const flightLookup = raw.dictionaries.flight[flightId]

    const result: FlightWithFares = {
      departureDateTime: flightLookup.departure.dateTime.substring(0, 19).replace("T", " "),
      arrivalDateTime: flightLookup.arrival.dateTime.substring(0, 19).replace("T", " "),
      origin: flightLookup.departure.locationCode,
      destination: flightLookup.arrival.locationCode,
      flightNo: `${flightLookup.marketingAirlineCode} ${flightLookup.marketingFlightNumber}`,
      duration: flightLookup.duration / 60,
      hasWifi: undefined,
      fares: []
    }

    // Skip flights with connections
    if (group.boundDetails.segments.length > 1)
      return

    const cabinLookup: { [ key: string ]: { cabinName: string, lowFareClass: string } } = {
      eco: { cabinName: "economy", lowFareClass: "X" },
      ecoPremium: { cabinName: "economy", lowFareClass: "X" },
      business: { cabinName: "business", lowFareClass: "I" },
      first: { cabinName: "first", lowFareClass: "" }   /////////////// TODO NEED CODE
    }

    group.airBounds.forEach((fare) => {
      const fareToAdd: FlightFare = {
        cabin: cabinLookup[fare.availabilityDetails[0].cabin].cabinName,
        isSaverFare: fare.availabilityDetails[0].bookingClass === cabinLookup[fare.availabilityDetails[0].cabin].lowFareClass,
        miles: fare.prices.milesConversion.convertedMiles.base,
        currencyOfCash: fare.prices.milesConversion.remainingNonConverted.currencyCode,
        cash: Math.ceil(fare.prices.milesConversion.convertedMiles.totalTaxes / 100),
        scraper: "aeroplan"
      }
      result.fares.push(fareToAdd)
    })

    results.push(result)
  })

  return results
}

module.exports = scraper
