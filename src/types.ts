import { ScraperModule } from "./scraper.js"

export type AwardWizScraperModule = ScraperModule<AwardWizQuery, FlightWithFares[]>
export type AwardWizQuery = { origin: string, destination: string, departureDate: string }
export type FlightWithFares = any
export type FlightFare = any
