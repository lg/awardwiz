// https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=SFO&dest0=YYZ&departureDate0=2022-06-04

// Notes:
// - domestic flights in "first" are actually business class
// Test:
// - A330|787|777 have pods in Business class (and no First class)

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

const hasPods = (aircraftName: string, carrierCode: string) => {
  if (carrierCode === "AC")
    return /A330|787|777/.test(aircraftName)
  if (carrierCode === "UA")
    return /777|757/.test(aircraftName)
  return false
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

    const aircraft = raw.dictionaries.aircraft[flightLookup.aircraftCode]
    const businessHasPods = hasPods(aircraft, flightLookup.marketingAirlineCode || flightLookup.operatingAirlineCode || "")

    group.airBounds.forEach((fare) => {
      const cabinShortToCabin: {[x: string]: string} = { eco: "economy", ecoPremium: "economy", business: "business", first: "first" }
      let cabin = cabinShortToCabin[fare.availabilityDetails[0].cabin]
      if (cabin === "first" && fare.availabilityDetails[0].bookingClass === "I")    // us domestic airlines claim business class is first
        cabin = "business"
      if (cabin === "business" && businessHasPods)    // danger for 3 class international flights
        cabin = "first"

      const { bookingClass } = fare.availabilityDetails[0]
      const isSaverFare = (cabin === "business" && bookingClass === "I") || (cabin === "economy" && bookingClass === "X") || (cabin === "first" && bookingClass === "O")

      const fareToAdd: FlightFare = {
        cabin,
        isSaverFare,
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
