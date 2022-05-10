export type ScraperQuery = {
  origin: string
  destination: string
  departureDate: string
}

export type ScraperResults = {
  flightsWithFares: FlightWithFares[]
  warnings: string[]
}

// the "| undefined" piece makes these require to explicitly be defined
export type FlightWithFares = {
  flightNo: string                       // "UA 123"
  departureDateTime: string              // "2022-04-01 15:12"
  arrivalDateTime: string                // "2022-04-01 15:12"
  origin: string                         // "SFO"
  destination: string                    // "LHR"
  airline: string | undefined            // "United Airlines"
  duration: number | undefined           // 62
  fares: FlightFare[]
}

export type ScraperCapabilities = {
  supportsConnections: false                      // To implement
  missingAttributes: (keyof FlightWithFares)[]    // Only these fields are expected to be undefined
}

export type FlightFare = {
  cabin: string                           // "economy" | "business" | "first"
  miles: number
  isSaverFare: boolean | undefined
  cash: number
  currencyOfCash: string
}
