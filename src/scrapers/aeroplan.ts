// https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=SFO&dest0=YYZ&departureDate0=2022-06-04

// Notes:
// - domestic flights in "first" are actually business class
// Test:
// - A330|787|777 have pods in Business class (and no First class)

import { HTTPResponse } from "puppeteer"
import { FlightWithFares, FlightFare } from "../types/scrapers"
import { ScraperMetadata, Scraper, browserlessInit, gotoPageAndWaitForResponse, BrowserlessInput } from "./common"
import type { AeroplanResponse } from "./samples/aeroplan"

const meta: ScraperMetadata = {
  name: "aeroplan",
  blockUrls: [
    "p11.techlab-cdn.com", "assets.adobedtm.com", // "ocsp.entrust.net", "crl.entrust.net", "aia.entrust.net" need blocking at proxy level
    "aircanada.demdex.net", // TODO I DONT THINK THESE WORK
    "assets/favicon_package", "assets/json/header", "assets/json/footer"
  ],
}

export const scraper: Scraper = async (page, query) => {
  const response = await gotoPageAndWaitForResponse({ page,
    url: `https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${query.origin}&dest0=${query.destination}&departureDate0=${query.departureDate}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=DOM`,
    waitForResponse: (checkResponse: HTTPResponse) => {
      return checkResponse.url() === "https://akamai-gw.dbaas.aircanada.com/loyalty/dapidynamic/1ASIUDALAC/v2/search/air-bounds" && checkResponse.request().method() === "POST"
    },
    maxResponseGapMs: 12000,
    waitMoreWhen: ["akamai-gw", "assets/"],
    waitMax: true // TODO: we really need async requests so we can take longer than 30s to fulfill some requests
  })
  const raw = await response.json() as AeroplanResponse

  const flightsWithFares: FlightWithFares[] = []
  if (raw.data?.airBoundGroups && raw.data.airBoundGroups.length > 0) {
    const flights = standardizeResults(raw, query.origin, query.destination)
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (raw: AeroplanResponse, origOrigin: string, origDestination: string) => {
  const results: FlightWithFares[] = []
  for (const group of raw.data?.airBoundGroups ?? []) {
    const { flightId } = group.boundDetails.segments[0]
    const flightLookup = raw.dictionaries.flight[flightId as keyof typeof raw.dictionaries.flight]

    const result: FlightWithFares = {
      departureDateTime: flightLookup.departure.dateTime.slice(0, 19).replace("T", " "),
      arrivalDateTime: flightLookup.arrival.dateTime.slice(0, 19).replace("T", " "),
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
      continue

    if (flightLookup.departure.locationCode !== origOrigin || flightLookup.arrival.locationCode !== origDestination)
      continue

    const aircraft = raw.dictionaries.aircraft[flightLookup.aircraftCode as keyof typeof raw.dictionaries.aircraft]
    if (!aircraft)
      throw new Error(`Unknown aircraft type: ${flightLookup.aircraftCode}`)

    for (const fare of group.airBounds) {
      const cabinShortToCabin: Record<string, string> = { eco: "economy", ecoPremium: "economy", business: "business", first: "first" }
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
    }

    results.push(result)
  }

  return results
}

module.exports = (input: BrowserlessInput) => browserlessInit(meta, scraper, input)
