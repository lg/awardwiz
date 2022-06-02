export type ScraperFunc = (query: BrowserlessQuery) => Promise<{ data: ScraperResults }>
export type ScraperCapabilities = {
  missingAttributes: (keyof FlightWithFares)[]    // Only these fields are expected to be undefined
  missingFareAttributes: (keyof FlightFare)[]    // Only these fields are expected to be undefined
}
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

export type ScraperResults = {
  flightsWithFares: FlightWithFares[]
}

// the "| undefined" piece makes these require to explicitly be defined
export type FlightWithFares = {
  flightNo: string                       // "UA 123"
  departureDateTime: string              // "2022-04-01 15:12"
  arrivalDateTime: string                // "2022-04-01 15:12"
  origin: string                         // "SFO"
  destination: string                    // "LHR"
  duration: number | undefined           // 62
  hasWifi: boolean | undefined           // true
  fares: FlightFare[]
  scraper: string
}

export type FlightFare = {
  cabin: string                           // "economy" | "business" | "first"
  miles: number
  isSaverFare: boolean | undefined
  cash: number
  currencyOfCash: string
}

export type SearchQuery = {
  origins: string[]
  destinations: string[]
  departureDate: string
}

declare type Airport = {
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

declare type AirportWithDistance = Airport & { distance: number }
