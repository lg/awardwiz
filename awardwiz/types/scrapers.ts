import type { QueryKey } from "@tanstack/react-query"
import { FlightRadar24Response } from "./fr24.js"

export type ScraperQuery = {
  origin: string
  destination: string
  departureDate: string
}

export type BrowserlessPostData = {
  code: string
  context: ScraperQuery
}

export type AWFR24Response = ScraperResponse<FlightRadar24Response>

export type ScraperResponse<T = FlightWithFares[]> = {
  result: T | undefined
  logLines: string[]

  // patched on after receiving
  forKey?: QueryKey
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
  iataCode: string
  name: string
  tzName: string
  popularity: number
}
