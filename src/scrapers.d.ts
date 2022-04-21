export type SearchQuery = {
  origin: string
  destination: string
  departureDate: string
  program: string
}

export type ScraperResults = {
  flightsWithFares: FlightWithFares[]
  warnings: string[]
}

export type FlightWithFares = {
  departureDateTime: string   // "2022-04-01 15:12"
  arrivalDateTime: string     // "2022-04-01 15:12"
  origin: string              // "SFO"
  destination: string         // "LHR"
  flightNo: string            // "UA 123"
  airline: string             // "United Airlines"
  duration: number            // 62
  fares: FlightFare[]
}

export type FlightFare = {
  cabin: string               // "economy" | "business" | "first"
  miles: number
  isSaverFare?: boolean
  cash: number
  currencyOfCash?: string
}
