export interface SkipLaggedResponse {
  airlines: Airlines
  cities: Cities
  airports: Airports
  flights: Flights
  itineraries: Itineraries
  info: Info
  duration: number
}

export interface Airlines {
  [key: string]: { name: string }
}

export interface Cities {
  [key: string]: { name: string }
}

export interface Airports {
  [key: string]: { name: string }
}

export interface Flights {
  [key: string]: Flight
}

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
