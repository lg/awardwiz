import * as ReactQuery from "react-query"
import axios from "axios"
import { FR24SearchResult } from "../types/fr24"
import { FlightWithFares, ScraperQuery, ScraperResults, SearchQuery } from "../types/scrapers"
import scrapers from "../scrapers/scrapers.json"
import * as ts from "typescript"

const scraperCode = import.meta.glob("../scrapers/*.ts", { as: "raw" })

export type QueryPairing = {origin: string, destination: string, departureDate: string}
export type ServingCarrier = { origin: string, destination: string, airlineCode: string, airlineName: string }
export type ScrapersForRoutes = {[key: string]: { origin: string, destination: string, scraper: string, matchedAirlines: string[], departureDate: string }}

export const useAwardSearch = (searchQuery: SearchQuery) => {
  // Take all origins and destinations and create a list of all possible pairs
  const pairings = searchQuery.origins.flatMap((origin) => searchQuery.destinations.map((destination) => ({ origin, destination, departureDate: searchQuery.departureDate }) as QueryPairing))

  // Return the list of carriers that fly the given pairings
  const servingCarriersObjs = pairings.map((pairing) => ({
    queryKey: ["servingCarriers", pairing.origin, pairing.destination],
    queryFn: async ({ signal }) => {
      const dataHtml = (await axios.post<string>("http://localhost:4000/content", { url: `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${pairing.origin}&destination=${pairing.destination}` }, { signal })).data
      const data: FR24SearchResult = JSON.parse(new DOMParser().parseFromString(dataHtml, "text/html").documentElement.textContent || "")

      if (data.errors)
        throw new Error(`${data.errors.message} -- ${JSON.stringify(data.errors.errors)}`)
      if (!data.result.response.flight.data)
        return []

      const carriers = data.result.response.flight.data
        .map((item) => ({ origin: item.airport.origin.code.iata, destination: item.airport.destination.code.iata, airlineCode: item.airline?.code.iata, airlineName: item.airline?.name } as ServingCarrier))
        .filter((item, index, self) => self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)   // remove duplicates
        .filter((item) => item.airlineCode && item.airlineName)   // remove flights without sufficient data (usually private flights)
        .filter((item) => !["1I", "FX", "KH", "5X", "8C", "KZ", "5Y", "OO"].includes(item.airlineCode!))
      return carriers
    },
  }) as ReactQuery.UseQueryOptions<ServingCarrier[]>)
  const servingCarriersQueries = ReactQuery.useQueries({ queries: servingCarriersObjs })

  const servingCarriers = servingCarriersQueries
    .filter((item) => item.data)
    .map((item) => item.data)
    .flat() as ServingCarrier[]

  // Group route+scraper and find which airline fits under which scraper
  const scrapersForRoutes: ScrapersForRoutes = {}
  servingCarriers.forEach((servingCarrier) => {
    scrapers.filter((scraper) => scraper.supportedAirlines.includes(servingCarrier.airlineCode!)).forEach((scraper) => {
      const key = `${servingCarrier.origin}${servingCarrier.destination}${scraper.name}`
      if (!scrapersForRoutes[key]) {
        scrapersForRoutes[key] = { origin: servingCarrier.origin, destination: servingCarrier.destination, scraper: scraper.name, matchedAirlines: [servingCarrier.airlineName], departureDate: searchQuery.departureDate }

      } else if (!scrapersForRoutes[key].matchedAirlines.includes(servingCarrier.airlineName)) {
        scrapersForRoutes[key].matchedAirlines.push(servingCarrier.airlineName)
      }
    })
  })

  // Run the scrapers
  const searchQueryObjs = Object.entries(scrapersForRoutes).map(([key, scraperQuery]) => ({
    queryKey: ["awardAvailability", key, scraperQuery.departureDate],
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 15,
    retry: 1,
    queryFn: async ({ signal }) => {
      const path = Object.keys(scraperCode).find((scraperKey) => scraperKey.indexOf(`${scraperQuery.scraper}.ts`) > -1)
      if (!path)
        throw new Error(`Could not find scraper ${scraperQuery.scraper}`)
      const tsCode = scraperCode[path] as unknown as string
      const jsCode = ts.transpile(tsCode, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS })

      const postData: { code: string, context: ScraperQuery } = { code: jsCode, context: scraperQuery }
      const scraperResults = (await axios.post<ScraperResults>("http://localhost:4000/function", postData, { signal })).data
      return scraperResults.flightsWithFares
    }
  }) as ReactQuery.UseQueryOptions<FlightWithFares[]>)
  const searchQueries = ReactQuery.useQueries({ queries: searchQueryObjs })

  const scraperResults = searchQueries
    .filter((item) => item.data)
    .map((item) => item.data)
    .flat() as FlightWithFares[]

  const loading = servingCarriersQueries.some((query) => query.isLoading) || searchQueries.some((query) => query.isLoading)
  const error = servingCarriersQueries.find((query) => query.error) || searchQueries.find((query) => query.error)

  return { searchResults: scraperResults, error: error && error?.error as Error, pairings, servingCarriers, scrapersForRoutes, isLoading: loading }
}
