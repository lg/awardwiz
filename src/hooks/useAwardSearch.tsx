import * as ReactQuery from "react-query"
import axios from "axios"
import { ExpandRecursively, FlightFare, FlightWithFares, ScraperQuery, ScraperResults, SearchQuery } from "../types/scrapers"
import scrapersRaw from "../scrapers/config.json?raw"
import { Scraper, ScrapersConfig } from "../types/config.schema"
import React from "react"
import { useQueriesWithKeys } from "../helpers/common"
import type { FlightRadar24Response } from "../scrapers/samples/fr24"
export const scraperConfig = JSON.parse(scrapersRaw) as ScrapersConfig

const scraperCode = import.meta.glob("../scrapers/*.ts", { as: "raw" })

export type QueryPairing = ExpandRecursively<{origin: string, destination: string, departureDate: string}>
export type ServingCarrier = ExpandRecursively<{ origin: string, destination: string, airlineCode: string, airlineName: string }>
type ScraperForRoute = ExpandRecursively<{ origin: string, destination: string, scraper: string, matchedAirlines: string[], departureDate: string }>
export type ScrapersForRoutes = ExpandRecursively<{[scraperOrigDestKey: string]: ScraperForRoute}>
export type AwardSearchProgress = {
  searchResults: FlightWithFares[],
  pairings: QueryPairing[],
  servingCarriers: ServingCarrier[],
  scrapersForRoutes: ScrapersForRoutes,
  loadingQueriesKeys: string[],
  errors: { queryKey: string, error: Error }[]
}

export const useAwardSearch = (searchQuery: SearchQuery): AwardSearchProgress => {
  // Take all origins and destinations and create a list of all possible pairs: [{origin, destination, departureDate}, ...]
  const pairings = searchQuery.origins.flatMap((origin) => searchQuery.destinations.map((destination) => ({ origin, destination, departureDate: searchQuery.departureDate }) as QueryPairing))

  // Returns the airlines flying a route as: [{origin, destination, airlineCode, airlineName}, ...]
  const { queries: servingCarriersQueries, data: servingCarriers } = useQueriesWithKeys<ServingCarrier[]>(pairings.map((pairing) => ({
    queryKey: `servingCarriers-${pairing.origin}-${pairing.destination}`,
    queryFn: fetchServingCarriers,
    meta: pairing
  })))

  // Group the above by "scraper-orig-dest" -> {matchedAirlines[], origin, destination, scraper, departureDate}
  const scrapersForRoutes = React.useMemo(() => {
    return servingCarriers.reduce((result, curCarrier) => {
      const compatibleScrapers = scraperConfig.scrapers.filter((checkScraper) => doesScraperSupportAirlineInclCashOnly(checkScraper, curCarrier.airlineCode))
      compatibleScrapers.forEach((scraper) => {
        const key = `${scraper.name}-${curCarrier.origin}-${curCarrier.destination}`
        result[key] ??= { ...curCarrier, scraper: scraper.name, matchedAirlines: [], departureDate: searchQuery.departureDate }
        if (!result[key].matchedAirlines.includes(curCarrier.airlineCode))
          result[key].matchedAirlines.push(curCarrier.airlineCode)
      })
      return result
    }, {} as ScrapersForRoutes)
  }, [servingCarriers, searchQuery])

  // Returns the scraper results from all scrapers: [{ flightNo, origin, amenities, ... }]
  const { queries: searchQueries, data: scraperResults } = useQueriesWithKeys<FlightWithFares[]>(Object.entries(scrapersForRoutes).map(([key, scraperQuery]) => ({
    queryKey: `awardAvailability-${key}-${scraperQuery.departureDate}`,
    staleTime: 1000 * 60 * 15,
    cacheTime: 1000 * 60 * 15,
    retry: 1,
    queryFn: fetchAwardAvailability,
    meta: scraperQuery,
  })))

  // Take the results and do final calculations (like merging like flights' details and merging amenities/fares)
  const flights = React.useMemo(() => {
    const ret = scraperResults.map((flight) => reduceToBestFarePerCabin(flight))
    return mergeFlightsByFlightNo(ret)
      .map((flight) => removeCashFaresFromUnsupportedAirlines(flight))
      .map((flight) => convertCashToMilesForCashOnlyScrapers(flight))
      .map((flight) => reduceToBestFarePerCabin(flight))
      .map((flight) => calculateAmenities(flight))
      .map((flight) => calculateSaverAwards(flight))
  }, [scraperResults])

  const loadingQueriesKeys = [servingCarriersQueries, searchQueries].flat().filter((item) => item.isFetching).map((item) => item.queryKey as string)
  const errors = [servingCarriersQueries, searchQueries].flat().filter((item) => item.error).map((item) => ({ queryKey: item.queryKey as string, error: item.error as Error }))

  return { searchResults: flights, pairings, servingCarriers, scrapersForRoutes, loadingQueriesKeys, errors }
}

//////////////////////

const reduceToBestFarePerCabin = (flight: FlightWithFares): FlightWithFares => {
  const scraperFares: { [scraperAndCabin: string]: FlightFare } = {}
  flight.fares.forEach((fare) => {
    if (!scraperFares[`${fare.scraper}${fare.cabin}`] || fare.miles < scraperFares[`${fare.scraper}${fare.cabin}`].miles)
      scraperFares[`${fare.scraper}${fare.cabin}`] = fare
  })

  return { ...flight, fares: Object.values(scraperFares) }
}

const fetchServingCarriers = async ({ signal, meta }: ReactQuery.QueryFunctionContext) => {
  const pairing = meta as QueryPairing
  const dataHtml = (await axios.post<string>(`${import.meta.env.VITE_BROWSERLESS_AWS_PROXY_URL}/content`, { url: `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${pairing.origin}&destination=${pairing.destination}` }, { headers: { "x-api-key": import.meta.env.VITE_BROWSERLESS_AWS_PROXY_API_KEY }, signal })).data
  const data: FlightRadar24Response = JSON.parse(new DOMParser().parseFromString(dataHtml, "text/html").documentElement.textContent || "")

  if (data.errors)
    throw new Error(`${data.errors.message} -- ${JSON.stringify(data.errors.errors)}`)
  if (!data.result.response.flight.data)
    return []

  const carriers = data.result.response.flight.data
    .map((item) => ({ origin: item.airport.origin.code.iata, destination: item.airport.destination.code.iata, airlineCode: item.airline?.code.iata, airlineName: item.airline?.name } as ServingCarrier))
    .filter((item, index, self) => self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)   // remove duplicates
    .filter((item) => item.airlineCode && item.airlineName)   // remove flights without sufficient data (usually private flights)
    .filter((item) => !scraperConfig.excludeAirlines?.includes(item.airlineCode!))
  return carriers
}

export const doesScraperSupportAirlineInclCashOnly = (scraper: Scraper, airlineCode: string): boolean => {
  if (scraper.disabled)
    return false
  const supported = (scraper.supportedAirlines as string[])  // initial list in scraper config
    .concat(scraper.cashOnlyFares! ? [airlineCode] : [])   // cash-only scrapers run for all airlines
    .flatMap((code) => scraperConfig.airlineGroups?.[code as keyof ScrapersConfig["airlineGroups"]] || code)  // expand groups
  return supported.includes(airlineCode)
}

export const doesScraperSupportAirlineExclCashOnly = (scraper: Scraper, airlineCode: string): boolean => {
  return doesScraperSupportAirlineInclCashOnly(scraper, airlineCode) && !scraper.cashOnlyFares
}

const fetchAwardAvailability = async ({ signal, meta, queryKey }: ReactQuery.QueryFunctionContext) => {
  const scraperQuery = meta as ScraperForRoute
  const scraperPath = (name: string) => {
    const localPath = Object.keys(scraperCode).find((scraperKey) => scraperKey.indexOf(`${name}.ts`) > -1)
    if (!localPath) throw new Error(`Could not find scraper ${name}`)
    return localPath
  }

  const tsCodeCommon = scraperCode[scraperPath("common")] as unknown as string
  let tsCode = scraperCode[scraperPath(scraperQuery.scraper)] as unknown as string
  tsCode = tsCode.replace(/import .* from "\.\/common"/, tsCodeCommon)
  const ts = await import("typescript")
  const jsCode = ts.transpile(tsCode, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS })

  const postData: { code: string, context: ScraperQuery } = { code: jsCode, context: scraperQuery }
  const scraperResults = (await axios.post<ScraperResults>(`${import.meta.env.VITE_BROWSERLESS_AWS_PROXY_URL}/function?key=${queryKey}`, postData, { headers: { "x-api-key": import.meta.env.VITE_BROWSERLESS_AWS_PROXY_API_KEY }, signal })).data

  return scraperResults.flightsWithFares
}

// A scraper can return cash fares for an airline (ex Southwest) which Chase Ultimate Rewards cash fares
// dont support. We keep the hinting of the flights here, but remove the fare.
const removeCashFaresFromUnsupportedAirlines = (flight: FlightWithFares): FlightWithFares => ({
  ...flight,
  fares: flight.fares.filter((fare) => {
    if (scraperConfig.scrapers.find((scraper) => scraper.name === fare.scraper)?.cashOnlyFares)
      return !scraperConfig.chaseUnsupportedAirlines?.includes(flight.flightNo.substring(0, 2))
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
const mergeFlightsByFlightNo = (scraperResults: FlightWithFares[]) => {
  const flights: FlightWithFares[] = []
  scraperResults.forEach((scraperResult) => {
    // Try to first match by flight number
    let existingFlight = flights.find((flight) => flight.flightNo === scraperResult.flightNo)

    // If no match, also check for codeshares
    if (!existingFlight) {
      existingFlight = flights.find((flight) => flight.departureDateTime.substring(0, 16) === scraperResult.departureDateTime.substring(0, 16) && flight.arrivalDateTime.substring(0, 16) === scraperResult.arrivalDateTime.substring(0, 16))
      if (existingFlight) {
        // If the existing flight is from a cash-only scraper, take the new flight number, since other scrapers don't usually use codeshare flights
        if (scraperConfig.scrapers.find((scraper) => scraper.name === existingFlight?.fares[0].scraper)?.cashOnlyFares)
          existingFlight.flightNo = scraperResult.flightNo
      }
    }

    if (existingFlight) {
      for (const key in scraperResult) {
        if (existingFlight[key as keyof FlightWithFares] === undefined) {
          // @ts-ignore
          existingFlight[key] = scraperResult[key]
        }
      }

      for (const k in scraperResult.amenities) {
        if (existingFlight.amenities[k as keyof FlightWithFares["amenities"]] === undefined)
          existingFlight.amenities[k as keyof FlightWithFares["amenities"]] = scraperResult.amenities[k as keyof FlightWithFares["amenities"]]
      }

      // Append in the fares
      existingFlight.fares.push(...scraperResult.fares)
    } else {
      flights.push(scraperResult)
    }
  })

  return flights
}

const calculateAmenities = (flight: FlightWithFares) => {
  const amenities = scraperConfig.airlineAmenities?.find((checkAmenity) => checkAmenity.airlineCode === flight.flightNo.substring(0, 2))
  const hasPods = amenities?.podsAircraft?.some((checkStr) => ((flight.aircraft || "").indexOf(checkStr) > -1 || checkStr === "*"))
  const hasWifi = amenities?.wifiAircraft?.some((checkStr) => ((flight.aircraft || "").indexOf(checkStr) > -1 || checkStr === "*"))
  return { ...flight, amenities: { ...flight.amenities, hasPods: flight.amenities.hasPods ?? hasPods, hasWiFi: flight.amenities.hasWiFi ?? hasWifi } }
}

const calculateSaverAwards = (flight: FlightWithFares) => {
  const fares = flight.fares.map((fare) => {
    let isSaver = fare.isSaverFare

    // If the airline has partners that we know about in the JSON, use that as the fare's saver award true/false
    const saverBookingClasses = Object.keys(scraperConfig.saverBookingClasses ?? {}).map((key) => {
      const keys = scraperConfig.airlineGroups?.[key as keyof ScrapersConfig["airlineGroups"]] ?? [key]   // Combine in groups
      return keys.some((checkKey) => checkKey === flight.flightNo.substring(0, 2)) ? scraperConfig.saverBookingClasses?.[key as keyof ScrapersConfig["saverBookingClasses"]] : undefined
    }).filter((bookingClasses): bookingClasses is string[] => !!bookingClasses).flat()    // join all matches
    if (isSaver === undefined && saverBookingClasses.length > 0)
      isSaver = saverBookingClasses.some((checkBookingClass) => fare.bookingClass === checkBookingClass)

    // If the scraper returned an airline's availability and it's not the scraper's native airline, assume it's a saver award
    const scraper = scraperConfig.scrapers.find((checkScraper) => checkScraper.name === fare.scraper)!
    if (isSaver === undefined && scraper.nativeAirline && flight.flightNo.substring(0, 2) !== scraper.nativeAirline)
      isSaver = true

    return { ...fare, isSaverFare: isSaver }
  })
  return { ...flight, fares }
}
