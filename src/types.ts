import { Page } from "playwright"

export type ScraperQuery = {
  origin: string
  destination: string
  departureDate: string
}

export type AwardWizRequest = {
  query: ScraperQuery
  meta: ScraperMetadata

  page: Page
  logLines: string[]
  randId: number
}

export type BrowserName = "chromium" | "webkit" | "firefox"

export type ScraperModule = { meta: ScraperMetadata, runScraper: Scraper }

export type Scraper = (req: AwardWizRequest) => Promise<FlightWithFares[]>
export type ScraperMetadata = {
  name: string,
  blockUrls?: string[]
  noRandomUserAgent?: boolean
  noBlocking?: boolean
  noStealth?: boolean
  useBrowser?: BrowserName
}

export type FlightWithFares = any
export type FlightFare = any
