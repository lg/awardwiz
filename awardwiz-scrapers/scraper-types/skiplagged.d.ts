export interface SkipLaggedResponse {
  airlines: Airlines
  cities: Cities
  airports: Airports
  flights?: Flights
  itineraries?: Itineraries
  info: Info
  duration: number

  success?: boolean
  message?: string
  message_localized?: string
}

export type Airlines = Record<string, { name: string }>

export type Cities = Record<string, { name: string }>

export type Airports = Record<string, { name: string }>

export type Flights = Record<string, Flight>

export interface Flight {
  segments: Segment[]
  duration: number
  count: number
  data: string
}

export interface Segment {
  airline: string
  flight_number: number
  departure: Departure
  arrival: Arrival
  duration: number
}

export interface Departure {
  time: string
  airport: string
}

export interface Arrival {
  time: string
  airport: string
}

export interface Itineraries {
  outbound: Outbound[]
}

export interface Outbound {
  data: string
  flight: string
  one_way_price: number
}

export interface Info {
  from: From
  to: To
}

export interface From {
  city: string
  state: string
  airports: string[]
}

export interface To {
  city: string
  state: string
  airports: string[]
}
