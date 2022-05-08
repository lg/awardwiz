import React from "react"
import * as ReactQuery from "react-query"
import { NodeIndexOutlined } from "@ant-design/icons"
import axios from "axios"
import moment from "moment"
import { genNewDebugTreeNode, useDebugTree } from "../components/DebugTree"
import type { SearchQuery } from "../types/types"
import { FR24SearchResult } from "../types/fr24"
import { FlightWithFares, ScraperQuery, ScraperResults } from "../types/scrapers"
import scrapers from "../scrapers/scrapers.json"
import * as ts from "typescript"
const scraperCode = import.meta.glob("../scrapers/*.ts", { as: "raw" })

type QueryPairing = {origin: string, destination: string, departureDate: string}
type ServingCarrier = { origin: string, destination: string, airlineCode: string, airlineName: string }

export const useAwardSearch = (searchQuery: SearchQuery) => {
  const debugTree = useDebugTree()

  // Take all origins and destinations and create a list of all possible pairs
  const [queryPairings, setQueryPairings] = React.useState<QueryPairing[]>([])  // 1-to-1 mappings of origin/destination (ex. SFO-HNL, OAK-HNL, SJC-HNL)
  React.useEffect(() => {
    const pairings = searchQuery.origins.flatMap((origin) => searchQuery.destinations.map((destination) => ({ origin, destination, departureDate: searchQuery.departureDate }) as QueryPairing))
    const debugChildren = pairings.map((pairing) => genNewDebugTreeNode({
      key: `${pairing.origin}${pairing.destination}`, textA: `${pairing.origin} → ${pairing.destination}`, origIcon: <NodeIndexOutlined />
    }))

    debugTree({ type: "update", payload: { key: "root", updateData: { textA: `Search for ${searchQuery.origins.join(",")} → ${searchQuery.destinations.join(",")} on ${searchQuery.departureDate}`, children: debugChildren } } })
    setQueryPairings(pairings)
  }, [searchQuery, debugTree])

  // Return the list of carriers that fly the given pairings
  const servingCarriersQueries = ReactQuery.useQueries({ queries:
    queryPairings.map((pairing) => {
      return {
        queryKey: ["servingCarriers", pairing.origin, pairing.destination],
        queryFn: async ({ signal }) => {
          const startTime = Date.now()
          debugTree({ type: "update", payload: { key: `${pairing.origin}${pairing.destination}`, updateData: { textB: "Requesting serving carriers...", isLoading: true } } })

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
            .filter((item) => !["1I", "FX", "KH", "5X", "8C"].includes(item.airlineCode!))

          debugTree({ type: "update", payload: { key: `${pairing.origin}${pairing.destination}`, updateData: { textB: `Success after ${Date.now() - startTime}ms`, isLoading: false } } })
          return carriers
        },
        onError: (err: Error) => debugTree({ type: "update", payload: { key: `${pairing.origin}${pairing.destination}`, updateData: { textB: `Error: ${err.message}`, isLoading: false } } })
      } as ReactQuery.UseQueryOptions<ServingCarrier[]>
    })
  })

  const servingCarriers = servingCarriersQueries
    .filter((item) => item.data)
    .map((item) => item.data)
    .flat() as ServingCarrier[]

  // // Figure out which scrapers are compatible for the given pairings
  // const [scrapeQueries, setScrapeQueries] = React.useState<ScraperQuery[]>([])
  // useDeepCompareEffect(() => {

  // Group route+scraper and find which airline fits under which scraper
  const scrapersForRoutes: {[key: string]: { origin: string, destination: string, scraper: string, matchedAirlines: string[], departureDate: string }} = {}
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
  const searchQueries = ReactQuery.useQueries({ queries:
    Object.values(scrapersForRoutes).map((scraperQuery) => {
      return {
        queryKey: ["awardAvailability", scraperQuery],
        staleTime: 1000 * 60 * 5,
        cacheTime: 1000 * 60 * 15,
        retry: 1,
        queryFn: async ({ signal }) => {
          const path = Object.keys(scraperCode).find((key) => key.indexOf(`${scraperQuery.scraper}.ts`) > -1)
          if (!path)
            throw new Error(`Could not find scraper ${scraperQuery.scraper}`)
          const tsCode = scraperCode[path] as unknown as string
          const jsCode = ts.transpile(tsCode, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS })

          const postData: { code: string, context: ScraperQuery } = { code: jsCode, context: scraperQuery }
          const scraperResults = (await axios.post<ScraperResults>("http://localhost:4000/function", postData, { signal })).data
          return scraperResults.flightsWithFares
        },
      } as ReactQuery.UseQueryOptions<FlightWithFares[]>
    })
  })

  const scraperResults = searchQueries
    .filter((item) => item.data)
    .map((item) => item.data)
    .flat() as FlightWithFares[]

  const isLoading = servingCarriersQueries.some((query) => query.isLoading) || searchQueries.some((query) => query.isLoading)
  const error = servingCarriersQueries.find((query) => query.error) || searchQueries.find((query) => query.error)
  const dataNoOlderThan = searchQueries.reduce((acc, query) => {
    return moment(query.dataUpdatedAt) < acc ? moment(query.dataUpdatedAt) : acc
  }, moment())

  return { searchResults: scraperResults, isLoading, error: error && error?.error as Error, dataNoOlderThan }
}
