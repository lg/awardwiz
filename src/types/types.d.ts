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
