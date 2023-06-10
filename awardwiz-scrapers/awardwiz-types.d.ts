import { ScraperMetadata, Arkalis } from "../arkalis/arkalis.ts"

export type ScraperResult<ReturnType> = {
  result: ReturnType | undefined
  logLines: string[]
}

export type AwardWizScraperModule = { meta: ScraperMetadata, runScraper: AwardWizScraper }
export type AwardWizScraper<ReturnType = FlightWithFares[]> = (req: Arkalis, query: AwardWizQuery) => Promise<ReturnType>
export type AwardWizQuery = { origin: string, destination: string, departureDate: string }

export type DatedRoute = { origin: string, destination: string, departureDate: string }

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
  cash: number                            // in dollars optionally with a decimal
  currencyOfCash: string
  scraper: string
  bookingClass: string | undefined        // (ex "I")

  isSaverFare?: boolean | undefined
}

export type FlightAmenities = {
  hasPods: boolean | undefined
  hasWiFi: boolean | undefined
}
