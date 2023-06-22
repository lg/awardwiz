import scrapersRaw from "../../config.json"
export const scraperConfig: ScrapersConfig = scrapersRaw

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

export const doesScraperSupportAirline = (scraper: Scraper, airlineCode: string, includeCashOnly: boolean): boolean => {
  if (scraper.disabled)
    return false
  const codes = new Set([...scraper.supportedAirlines, ...(scraper.cashOnlyFares ? [airlineCode] : [])]   // cash-only scrapers run for all airlines
    .flatMap((code) => scraperConfig.airlineGroups?.[code as keyof ScrapersConfig["airlineGroups"]] ?? code))  // expand references airline groups inplace

  return includeCashOnly ? codes.has(airlineCode) : (codes.has(airlineCode) && !scraper.cashOnlyFares)
}

