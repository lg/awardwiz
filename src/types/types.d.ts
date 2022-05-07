import { ScraperResults } from "./scrapers"

export type LambdaRequest = {
  code: string,
  context: ScraperQuery,
  browser: "firefox" | "chromium" | "webkit"
  browserArgs: string[]
}

export type LambdaResponse = {
  scraperResults: ScraperResults
}

export type ScraperModule = {
  run: (page: Page, query: ScraperQuery) => Promise<ScraperResults>
}

export type SearchQuery = {
  origins: string[]
  destinations: string[]
  departureDate: string
  program: string
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
