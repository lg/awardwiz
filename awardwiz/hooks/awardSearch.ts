import scrapersRaw from "../../config.json"
import { runScraper } from "../helpers/runScraper.js"
import { AWFR24Response, FlightAmenities, FlightFare, FlightWithFares, ScraperResponse, SearchQuery } from "../types/scrapers.js"
export const scraperConfig: ScrapersConfig = scrapersRaw

/** NOTE: Ensure that you run `just gen-json-schemas` to generate a new schema if you edit the below. */
/** Config file that describes which scrapers are available, which airlines they support, and other airline rules */
export type ScrapersConfig = {
  /** Airline codes for airlines which should not be processed (ex. cargo airlines: `["FX"]`) */
  excludeAirlines?: string[]

  /** Chase Ultimate Rewards only supports some airlines for booking cash fares, list the ones it doesn't here (ex. WN) */
  chaseUnsupportedAirlines?: string[]

  /** Group name to array of airlines mapping (ex. `{"staralliance": ["AC", "UA"]}`) */
  airlineGroups?: { [groupName: string]: string[] }             // eslint-disable-line -- because typescript-json-schema doesnt support Record

  /** Booking codes (per airline or group) to identify as saver results (ex. `{"UA": ["I", "O"]}`) used in addition to the scraper's `isSaver` */
  saverBookingClasses?: { [airlineOrGroup: string]: string[] }  // eslint-disable-line -- because typescript-json-schema doesnt support Record

  /** Defines amenities available depending on aircraft type for an airline */
  airlineAmenities?: AirlineAmenity[]

  /** Defines scraper metadata used to select which scrapers to use for a query */
  scrapers: Scraper[]
}

/** Defines scraper metadata used to select which scrapers to use for a query */
export type Scraper = {
  /** Name of the scraper (also the filename of the scraper) */
  name: string

  /** Set to true if this scraper should not be used */
  disabled?: boolean

  /** List of airline codes or group names which should trigger to use this scraper */
  supportedAirlines: string[]

  /** Airline code that this scraper defaults to (ex. aeroplan is "AC") */
  nativeAirline?: string | null

  /** Identifies this scraper to be used for all search queries */
  cashOnlyFares?: boolean
}

/** Defines amenities available depending on aircraft type for an airline */
export type AirlineAmenity = {
  /** Airline code (ex. UA) this amenity set is for */
  airlineCode?: string

  /** Aircraft types which have pods as the first class or business seats (ex. ["777", "Mint"]). Use "*" to identify all. */
  podsAircraft?: string[]

  /** Aircraft types which have WiFi available (ex. ["777"]). Use "*" to identify all. */
  wifiAircraft?: string[]
}

///////////////////////

export type DatedRoute = { origin: string, destination: string, departureDate: string }
export type ScraperToRun = { scraperName: string, forAirlines: string[], forDatedRoute: DatedRoute }
export type AirlineRoute = { origin: string, destination: string, airlineCode: string, airlineName: string } // remove airlinename

///////////////////////

export const findAwardFlights = async (searchQuery: SearchQuery): Promise<FlightWithFares[]> => {
  const allRoutes = expandOriginsDestinations(searchQuery)
  const fr24Responses = await Promise.all(allRoutes.map(async (route) => {
    const datedRoute: DatedRoute = { origin: route.origin, destination: route.destination, departureDate: route.departureDate }
    return runScraper<AWFR24Response>("fr24", datedRoute, undefined)
  }))
  const airlineRoutes = fr24Responses.flatMap((response) => fr24ResponseToAirlineRoutes(response))
  const scrapersToRun = scrapersByAirlineRoutes(airlineRoutes, searchQuery.departureDate)
  const scraperResponses = await Promise.all(scrapersToRun.map(async (scraperToRun) => {
    const datedRoute: DatedRoute = { origin: scraperToRun.forDatedRoute.origin, destination: scraperToRun.forDatedRoute.destination, departureDate: scraperToRun.forDatedRoute.departureDate }
    return runScraper(scraperToRun.scraperName, datedRoute, undefined)
  }))

  return flightsFromScraperResponses(scraperResponses)
}

///////////////////////

export const expandOriginsDestinations = (searchQuery: SearchQuery) => {
  return searchQuery.origins.flatMap((origin) => {
    return searchQuery.destinations.map((destination) => (
      { origin, destination, departureDate: searchQuery.departureDate } as DatedRoute
    ))
  })
}

export const fr24ResponseToAirlineRoutes = (response: AWFR24Response): AirlineRoute[] => {
  const data = response.result
  if (data === undefined)
    throw new Error("Couldn't retrieve airlines serving route")
  if (data.errors)
    throw new Error(`${data.errors.message} -- ${JSON.stringify(data.errors.errors)}`)
  if (!data.result?.response.flight.data)
    return []

  return data.result.response.flight.data
    .map((item) => ({
      origin: item.airport.origin.code.iata,
      destination: item.airport.destination.code.iata,
      airlineCode: item.airline?.code.iata ?? "",
      airlineName: item.airline?.name ?? "",
    } as AirlineRoute))

    // dont take airlines who dont have a name/code
    .filter((item) => item.airlineName !== "" && item.airlineCode !== "")

    // remove duplicates
    .filter((item, index, self) =>
      self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)

    // remove if airline is excluded
    .filter((item) => !scraperConfig.excludeAirlines?.includes(item.airlineCode))
}

export const scrapersByAirlineRoutes = (airlineRoutes: AirlineRoute[], departureDate: string): ScraperToRun[] => {
  const results: ScraperToRun[] = []
  for (const airlineRoute of airlineRoutes) {
    const datedRoute: DatedRoute = { origin: airlineRoute.origin, destination: airlineRoute.destination, departureDate }
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
  }
  return results
}

export const doesScraperSupportAirline = (scraper: Scraper, airlineCode: string, includeCashOnly: boolean): boolean => {
  if (scraper.disabled)
    return false
  const codes = new Set([...scraper.supportedAirlines, ...(scraper.cashOnlyFares ? [airlineCode] : [])]   // cash-only scrapers run for all airlines
    .flatMap((code) => scraperConfig.airlineGroups?.[code as keyof ScrapersConfig["airlineGroups"]] ?? code))  // expand references airline groups inplace

  return includeCashOnly ? codes.has(airlineCode) : (codes.has(airlineCode) && !scraper.cashOnlyFares)
}

////////////////////////////////

export const flightsFromScraperResponses = (scraperResponses: ScraperResponse[]): FlightWithFares[] => {
  const flightsWithFares = scraperResponses.flatMap((response) => response.result ?? [])

  const flightsIn = flightsWithFares.map((flight) => reduceFaresToBestPerCabin(flight))
  const flightsOut = mergeFlightsByFlightNo(flightsIn)
    .map((flight) => removeCashFaresFromUnsupportedAirlines(flight))
    .map((flight) => convertCashToMilesForCashOnlyScrapers(flight))
    .map((flight) => reduceFaresToBestPerCabin(flight))
    .map((flight) => calculateAmenities(flight))
    .map((flight) => calculateSaverAwards(flight))
  return flightsOut
}

const reduceFaresToBestPerCabin = (flight: FlightWithFares): FlightWithFares => {
  const scraperFares: Record<string, FlightFare | undefined> = {}
  for (const fare of flight.fares) {
    if (!scraperFares[`${fare.scraper}${fare.cabin}`] || fare.miles < scraperFares[`${fare.scraper}${fare.cabin}`]!.miles)
      scraperFares[`${fare.scraper}${fare.cabin}`] = fare
  }

  return { ...flight, fares: Object.values(scraperFares) as FlightFare[] }
}

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
      if (existingFlight && scraperConfig.scrapers.find((scraper) => scraper.name === existingFlight?.fares[0]!.scraper)?.cashOnlyFares)
        existingFlight.flightNo = flight.flightNo
    }

    if (existingFlight) {
      for (const key in flight) {
        if (existingFlight[key as keyof FlightWithFares] === undefined) {
          // TODO: need a better way to do this
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
