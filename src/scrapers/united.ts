import type { FlightWithFares } from "../types/scrapers"
import { browserlessInit, gotoPage, log, pptrFetch, Scraper, ScraperMetadata } from "./common"
import type { Trip, UnitedResponse } from "./samples/united"

const meta: ScraperMetadata = {
  name: "united"
}

export const scraper: Scraper = async (page, query) => {
  log("getting token")
  const tokenReq = await gotoPage(page, "https://www.united.com/api/token/anonymous")
  const tokenXml = await tokenReq!.text()
  const token = tokenXml.match(/<hash>(.*)<\/hash>/)?.[1]
  if (token === undefined)
    throw new Error("Token missing from response")

  log("fetching availability")
  const result = await pptrFetch(page, "https://www.united.com/api/flight/FetchFlights", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "x-authorization-api": `bearer ${token}`
    },
    body: JSON.stringify({
      "SearchTypeSelection": 1,
      "SortType": "stops_low",
      "SortTypeDescending": false,
      "Trips": [{
        "Origin": query.origin,
        "Destination": query.destination,
        "DepartDate": query.departureDate,
        "Index": 1,
        "TripIndex": 1,
        "SearchRadiusMilesOrigin": "-1",
        "SearchRadiusMilesDestination": "-1",
        "DepartTimeApprox": 0,
        "SearchFiltersIn": {
          "FareFamily": "ECONOMY",
          "AirportsStop": null,
          "AirportsStopToAvoid": null,
          "StopCountMin": 0,
          "StopCountMax": 0
        }
      }],
      "CabinPreferenceMain": "economy",
      "PaxInfoList": [{ "PaxType": 1 }],
      "AwardTravel": true,
      "NGRP": true,
      "CalendarLengthOfStay": 0,
      "PetCount": 0,
      "CalendarFilters": { "Filters": { "PriceScheduleOptions": { "Stops": 0 } } },
      "Characteristics": [
        { "Code": "SOFT_LOGGED_IN", "Value": false },
        { "Code": "UsePassedCartId", "Value": false }
      ],
      "FareType": "mixedtoggle"
    })
  }, 12000)

  log("parsing")
  const raw = JSON.parse(result) as UnitedResponse

  const flightsWithFares: FlightWithFares[] = []
  if ((raw.data?.Trips || []).length > 0) {
    const flights = standardizeResults(raw.data!.Trips[0])
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
