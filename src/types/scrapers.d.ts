import { QueryKey } from "@tanstack/react-query"

export type ScraperQuery = {
  origin: string
  destination: string
  departureDate: string
}

export type BrowserlessPostData = {
  code: string
  context: ScraperQuery
}

export type ScraperResponse = {
  flightsWithFares: FlightWithFares[]
  errored: boolean
  log: string[]

  // patched on after receiving
  forKey?: QueryKey
  retries?: number
}

// the "| undefined" piece makes these require to explicitly be defined
export type FlightWithFares = {
  flightNo: string                       // "UA 123"
  departureDateTime: string              // "2022-04-01 15:12"
  arrivalDateTime: string                // "2022-04-01 15:12"
  origin: string                         // "SFO"
  destination: string                    // "LHR"
  duration: number | undefined           // 62 (in minutes)
  aircraft: string | undefined           // "737"
  fares: FlightFare[]
  amenities: FlightAmenities
}

export type FlightFare = {
  cabin: string                           // "economy" | "business" | "first"
  miles: number
  cash: number
  currencyOfCash: string
  scraper: string
  bookingClass: string | undefined        // (ex "I")

  isSaverFare?: boolean | undefined
}

export type FlightAmenities = {
  hasPods: boolean | undefined
  hasWiFi: boolean | undefined
}

export type SearchQuery = {
  origins: string[]
  destinations: string[]
  departureDate: string
}

export type Airport = {
  icao_code: string
  iata_code: string
  name: string
  longitude: number
  latitude: number
  url: string | null
  popularity: number
  city: string
  country: string
  tz_name: string | undefined
}
