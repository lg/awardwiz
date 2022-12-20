import { ScraperMetadata, ScraperRequest } from "./scraper.js"

export type AwardWizScraperModule = { meta: ScraperMetadata, runScraper: AwardWizScraper }
export type AwardWizScraper = (req: ScraperRequest, query: AwardWizQuery) => Promise<FlightWithFares[]>
export type AwardWizQuery = { origin: string, destination: string, departureDate: string }
export type FlightWithFares = any
export type FlightFare = any
