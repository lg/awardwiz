import { QueryKey } from "@tanstack/react-query"
import type { Page } from "puppeteer"

export type ScraperFunc = (query: BrowserlessQuery) => Promise<{ data: ScraperResponse }>
export type BrowserlessQuery = {
  page: Page,
  context: ScraperQuery,
  browser?: Browser,
  timeout?: number
}

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
  internalRetries: number
  log: string[]

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
  duration: number                       // 62 (in minutes)
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
}

// These two are here to help hack VSCode to give the full definition when hovering over a type
export type Expand<T> = T extends (...args: infer A) => infer R
  ? (...args: Expand<A>) => Expand<R>
  : T extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
  ? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
  : T extends object
  ? T extends infer O
    ? { [K in keyof O]: ExpandRecursively<O[K]> }
    : never
  : T;
