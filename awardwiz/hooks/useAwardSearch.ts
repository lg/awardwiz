import * as ReactQuery from "@tanstack/react-query"
import { AxiosError } from "axios"
import { FlightFare, FlightWithFares, ScraperResponse, SearchQuery, FlightAmenities, FR24Response } from "../types/scrapers"
import scrapersRaw from "../config.json"
import { Scraper, ScrapersConfig } from "../types/config.schema"
import React from "react"
import { useQueryClient, UseQueryOptions } from "@tanstack/react-query"
import { runScraper } from "../helpers/runScraper"

export const scraperConfig = scrapersRaw as ScrapersConfig

export type DatedRoute = { origin: string, destination: string, departureDate: string }
export type AirlineRoute = { origin: string, destination: string, airlineCode: string, airlineName: string } // remove airlinename
export type ScraperToRun = { scraperName: string, forAirlines: string[], forDatedRoute: DatedRoute }
export type UseQueryMeta = { scraperToRun: ScraperToRun }

export type ScraperError = { name: "ScraperError", message: string, logLines: string[] }

export type AwardSearchProgress = {
  datedRoutes: DatedRoute[],                     // [{origin, destination, departureDate}]
  airlineRoutes: AirlineRoute[],                 // [{origin, destination, airlineCode, airlineName}]
  scrapersToRun: ScraperToRun[],                 // [{scraper, forAirlines[], forDatedRoute}]
  scraperResponses: ScraperResponse[],           // [{forKey, flightsWithFares={origin, dest, ...}}, errored, ...}]

  searchResults: FlightWithFares[],
  loadingQueriesKeys: ReactQuery.QueryKey[],
  errors: { queryKey: ReactQuery.QueryKey, error: Error }[]

  stop: () => Promise<void>
}

export const queryKeyForAirlineRoute = (datedRoute: DatedRoute): ReactQuery.QueryKey => [`airlineRoutes-${datedRoute.origin}-${datedRoute.destination}`]
export const queryKeyForScraperResponse = (scraperToRun: ScraperToRun): ReactQuery.QueryKey => [`awardAvailability-${scraperToRun.scraperName}-${scraperToRun.forDatedRoute.origin}-${scraperToRun.forDatedRoute.destination}-${scraperToRun.forDatedRoute.departureDate}`]
export const queryKeysEqual = (a: ReactQuery.QueryKey, b: ReactQuery.QueryKey): boolean => ReactQuery.hashQueryKey(a) === ReactQuery.hashQueryKey(b)

export const useAwardSearch = (searchQuery: SearchQuery): AwardSearchProgress => {
  const queryClient = useQueryClient()
  const [stoppedQueries, setStoppedQueries] = React.useState<ReactQuery.QueryKey[]>([])

  // Take all origins and destinations and create a list of all possible pairs: [{origin, destination, departureDate}]
  const datedRoutes = React.useMemo(() => {
    setStoppedQueries([])
    return searchQuery.origins.flatMap((origin) => searchQuery.destinations.map((destination) => ({ origin, destination, departureDate: searchQuery.departureDate } as DatedRoute)))
  }, [searchQuery])

  // Returns the airlines flying a route: [{origin, destination, airlineCode, airlineName}]
  const airlineRouteQueriesOpts = datedRoutes.map((datedRoute): UseQueryOptions<AirlineRoute[], Error> => ({
    queryKey: queryKeyForAirlineRoute(datedRoute),
    queryFn: fetchAirlineRoutes,
    meta: datedRoute,
    staleTime: 1000 * 60 * 60 * 24 * 30,
    cacheTime: 1000 * 60 * 60 * 24 * 30,
    retry: 3,
    enabled: !stoppedQueries.some((stoppedQuery) => queryKeysEqual(stoppedQuery, queryKeyForAirlineRoute(datedRoute)))
  }))
  const airlineRouteQueries = ReactQuery.useQueries({ queries: airlineRouteQueriesOpts })
  const keyedAirlineRouteQueries = airlineRouteQueries.map((query, index) => ({ ...query, queryKey: airlineRouteQueriesOpts[index].queryKey! }))

  // Returns the list of scraper-airline-route-date that'll be necessary to run: [{scraper, matchedAirlines[]}]
  const { scrapersToRun, airlineRoutes } = React.useMemo(() => {
    const stableAirlineRoutes = airlineRouteQueries.flatMap((query) => query.data).filter((item): item is AirlineRoute => !!item)

    const scrapersToRunReturn = stableAirlineRoutes.reduce<ScraperToRun[]>((results, airlineRoute) => {
      const datedRoute: DatedRoute = { origin: airlineRoute.origin, destination: airlineRoute.destination, departureDate: searchQuery.departureDate }
      const compatibleScrapers = scraperConfig.scrapers.filter((checkScraper) => doesScraperSupportAirline(checkScraper, airlineRoute.airlineCode, true))
      for (const scraper of compatibleScrapers) {
        const existingItem = results.find((item) => item.scraperName === scraper.name && item.forDatedRoute.origin === datedRoute.origin && item.forDatedRoute.destination === datedRoute.destination)
        if (existingItem) {
          if (!existingItem.forAirlines.includes(airlineRoute.airlineCode))
            existingItem.forAirlines.push(airlineRoute.airlineCode)
        } else {
          results.push({ scraperName: scraper.name, forAirlines: [airlineRoute.airlineCode], forDatedRoute: datedRoute })
        }
      }
      return results
    }, [])

    return { scrapersToRun: scrapersToRunReturn, airlineRoutes: stableAirlineRoutes }
  }, [airlineRouteQueries, searchQuery.departureDate])

  // Returns the scraper results from all scrapers: [{ flightsWithFares: { flightNo, origin, amenities, ... }, errored, ]
  const scraperQueriesOpts = scrapersToRun.map((scraperToRun): UseQueryOptions<ScraperResponse, Error> => ({
    queryKey: queryKeyForScraperResponse(scraperToRun),
    staleTime: 1000 * 60 * 15,
    cacheTime: 1000 * 60 * 15,
    queryFn: fetchAwardAvailability,
    meta: { scraperToRun } as UseQueryMeta,
    refetchOnWindowFocus: () => !queryClient.getQueryState<ScraperResponse, { message: string, log: string[]}>(queryKeyForScraperResponse(scraperToRun))?.error,  // dont refresh if it was an error
    enabled: !stoppedQueries.some((check) => queryKeysEqual(check, queryKeyForScraperResponse(scraperToRun)))
  }))
  const scraperQueries = ReactQuery.useQueries({ queries: scraperQueriesOpts })
  const keyedScraperQueries = scraperQueries.map((query, index) => ({ ...query, queryKey: scraperQueriesOpts[index].queryKey! }))

  // Take the results and do final calculations (like merging like flights' details and merging amenities/fares)
  const { flights, scraperResponses } = React.useMemo(() => {
    const scraperResponses = scraperQueries.flatMap((query) => query.data).filter((item): item is ScraperResponse => !!item)
    const flightsWithFares = scraperResponses.flatMap((response) => response.result ?? [])

    const flightsIn = flightsWithFares.map((flight) => reduceFaresToBestPerCabin(flight))
    const flightsOut = mergeFlightsByFlightNo(flightsIn)
      .map((flight) => removeCashFaresFromUnsupportedAirlines(flight))
      .map((flight) => convertCashToMilesForCashOnlyScrapers(flight))
      .map((flight) => reduceFaresToBestPerCabin(flight))
      .map((flight) => calculateAmenities(flight))
      .map((flight) => calculateSaverAwards(flight))

    return { flights: flightsOut, scraperResponses }
  }, [scraperQueries])

  const loadingQueriesKeys = [keyedAirlineRouteQueries, keyedScraperQueries].flat().filter((item) => item.isFetching).map((item) => item.queryKey)
  const errorsQueries = [keyedAirlineRouteQueries, keyedScraperQueries].flat().filter((item) => item.error ?? stoppedQueries.some((check) => queryKeysEqual(check, item.queryKey)))
  const errors = errorsQueries.map((query) => ({ queryKey: query.queryKey, error: (query.error as Error | undefined) ?? new Error("stopped") }))

  const stop = async () => {
    setStoppedQueries([...loadingQueriesKeys])
    await Promise.all(loadingQueriesKeys.map((queryKey) => queryClient.cancelQueries(queryKey)))
  }

  return { searchResults: flights, datedRoutes, airlineRoutes, scrapersToRun, scraperResponses, loadingQueriesKeys, errors, stop }
}

//////////////////////

const reduceFaresToBestPerCabin = (flight: FlightWithFares): FlightWithFares => {
  const scraperFares: Record<string, FlightFare | undefined> = {}
  for (const fare of flight.fares) {
    if (!scraperFares[`${fare.scraper}${fare.cabin}`] || fare.miles < scraperFares[`${fare.scraper}${fare.cabin}`]!.miles)
      scraperFares[`${fare.scraper}${fare.cabin}`] = fare
  }

  return { ...flight, fares: Object.values(scraperFares) as FlightFare[] }
}

const fetchAirlineRoutes = async ({ signal, meta }: ReactQuery.QueryFunctionContext): Promise<AirlineRoute[]> => {
  const datedRoute = meta as DatedRoute

  const request = await runScraper<FR24Response>("fr24", datedRoute, signal)
  if (request.data.result === undefined)
    throw new Error("Couldn't retrieve airlines serving route")

  const data = request.data.result

  if (data.errors)
    throw new Error(`${data.errors.message} -- ${JSON.stringify(data.errors.errors)}`)
  if (!data.result?.response.flight.data)
    return []

  return data.result.response.flight.data
    .map((item) => ({ origin: item.airport.origin.code.iata, destination: item.airport.destination.code.iata, airlineCode: item.airline?.code.iata, airlineName: item.airline?.name }))
    .filter((item): item is AirlineRoute => !!item.airlineName && !!item.airlineCode)    // dont take airlines who dont have a name/code
    .filter((item, index, self) => self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)   // remove duplicates
    .filter((item) => !scraperConfig.excludeAirlines?.includes(item.airlineCode!))
}

export const doesScraperSupportAirline = (scraper: Scraper, airlineCode: string, includeCashOnly: boolean): boolean => {
  if (scraper.disabled)
    return false
  const codes = new Set([...scraper.supportedAirlines, ...(scraper.cashOnlyFares ? [airlineCode] : [])]   // cash-only scrapers run for all airlines
    .flatMap((code) => scraperConfig.airlineGroups?.[code as keyof ScrapersConfig["airlineGroups"]] ?? code))  // expand references airline groups inplace

  return includeCashOnly ? codes.has(airlineCode) : (codes.has(airlineCode) && !scraper.cashOnlyFares)
}

const fetchAwardAvailability = async ({ signal, meta: metaRaw, queryKey }: ReactQuery.QueryFunctionContext): Promise<ScraperResponse> => {
  const meta = metaRaw as UseQueryMeta
  const scraperToRun = meta.scraperToRun

  const response = await runScraper(scraperToRun.scraperName, scraperToRun.forDatedRoute, signal).catch((error: AxiosError<ScraperResponse>) => {
    if (error.response?.data)
      throw { logLines: error.response.data.logLines, message: "Internal scraper error", name: "ScraperError" } as ScraperError
    throw { logLines: [ "*** Network error calling scraper ***", error.message ], message: "Network error calling scraper", name: "ScraperError" } as ScraperError
  })
  response.data.forKey = queryKey
  return response.data
}

// A scraper can return cash fares for an airline (ex Southwest) which Chase Ultimate Rewards cash fares
// dont support. We keep the hinting of the flights here, but remove the fare.
const removeCashFaresFromUnsupportedAirlines = (flight: FlightWithFares): FlightWithFares => ({
  ...flight,
  fares: flight.fares.filter((fare) => {
    if (scraperConfig.scrapers.find((scraper) => scraper.name === fare.scraper)?.cashOnlyFares)
      return !scraperConfig.chaseUnsupportedAirlines?.includes(flight.flightNo.slice(0, 2))
    return true
  })
})

const convertCashToMilesForCashOnlyScrapers = (flight: FlightWithFares) => ({
  ...flight,
  fares: flight.fares.map((fare) => {
    if (!scraperConfig.scrapers.find((scraper) => scraper.name === fare.scraper)?.cashOnlyFares)
      return fare
    return { ...fare, miles: (fare.cash * 100) / 1.5, cash: 0 }
  })
})

// Merges properties of FlightWithFares into unique FlightWithFares by flightNo
const mergeFlightsByFlightNo = (flights: FlightWithFares[]) => {
  const returnFlights: FlightWithFares[] = []
  for (const flight of flights) {
    // Try to first match by flight number
    let existingFlight = returnFlights.find((returnFlight) => returnFlight.flightNo === flight.flightNo)

    // If no match, also check for codeshares
    if (!existingFlight) {
      existingFlight = returnFlights.find((returnFlight) => returnFlight.departureDateTime.slice(0, 16) === flight.departureDateTime.slice(0, 16) && returnFlight.arrivalDateTime.slice(0, 16) === flight.arrivalDateTime.slice(0, 16))

      // If the existing flight is from a cash-only scraper, take the new flight number, since other scrapers don't usually use codeshare flights
      if (existingFlight && scraperConfig.scrapers.find((scraper) => scraper.name === existingFlight?.fares[0].scraper)?.cashOnlyFares)
        existingFlight.flightNo = flight.flightNo
    }

    if (existingFlight) {
      for (const key in flight) {
        if (existingFlight[key as keyof FlightWithFares] === undefined) {
          // @ts-expect-error
          existingFlight[key] = flight[key]
        }
      }

      for (const k in flight.amenities) {
        if (existingFlight.amenities[k as keyof FlightAmenities] === undefined)
          existingFlight.amenities[k as keyof FlightAmenities] = flight.amenities[k as keyof FlightAmenities]
      }

      // Append in the fares
      existingFlight.fares.push(...flight.fares)
    } else {
      returnFlights.push(flight)
    }
  }

  return returnFlights
}

const calculateAmenities = (flight: FlightWithFares) => {
  const amenities = scraperConfig.airlineAmenities?.find((checkAmenity) => checkAmenity.airlineCode === flight.flightNo.slice(0, 2))
  const hasPods = amenities?.podsAircraft?.some((checkText) => ((flight.aircraft ?? "").includes(checkText) || checkText === "*"))
  const hasWifi = amenities?.wifiAircraft?.some((checkText) => ((flight.aircraft ?? "").includes(checkText) || checkText === "*"))
  return { ...flight, amenities: { ...flight.amenities, hasPods: flight.amenities.hasPods ?? hasPods, hasWiFi: flight.amenities.hasWiFi ?? hasWifi } }
}

const calculateSaverAwards = (flight: FlightWithFares) => {
  const fares = flight.fares.map((fare) => {
    let isSaver = fare.isSaverFare

    // If the airline has partners that we know about in the JSON, use that as the fare's saver award true/false
    const saverBookingClasses = Object.keys(scraperConfig.saverBookingClasses ?? {}).map((key) => {
      const keys = scraperConfig.airlineGroups?.[key as keyof ScrapersConfig["airlineGroups"]] ?? [key]   // Combine in groups
      return keys.includes(flight.flightNo.slice(0, 2)) ? scraperConfig.saverBookingClasses?.[key as keyof ScrapersConfig["saverBookingClasses"]] : undefined
    }).filter((bookingClasses): bookingClasses is string[] => !!bookingClasses).flat()    // join all matches

    if (isSaver === undefined && saverBookingClasses.length > 0)
      isSaver = saverBookingClasses.includes(fare.bookingClass!)

    // If the scraper returned an airline's availability and it's not the scraper's native airline, assume it's a saver award
    const scraper = scraperConfig.scrapers.find((checkScraper) => checkScraper.name === fare.scraper)!
    if (isSaver === undefined && scraper.nativeAirline && flight.flightNo.slice(0, 2) !== scraper.nativeAirline)
      isSaver = true

    return { ...fare, isSaverFare: isSaver }
  })
  return { ...flight, fares }
}
