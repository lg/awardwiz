export interface JetBlueFetchFlights {
  dategroup: Dategroup[]
  fareGroup: FareGroup[]
  itinerary: Itinerary[]
  stopsFilter: number[]
  countryCode: string
  currency: string
  programName: string
  isTransatlanticRoute: boolean
}

export interface Dategroup {
  to: string
  from: string
  group: Group[]
}

export interface Group {
  uri: string
  date: string
  points: string
  fareTax: string
}

export interface FareGroup {
  fareCode: string
  bundleList: BundleList[]
}

export interface BundleList {
  itineraryID: string
  id: string
  code: string
  points: string
  fareTax: string
  cabinclass: string
  isSelected: boolean
  status: string
  isQuickest: boolean
  isLowest: boolean
  bookingclass?: string
  fareCode?: string
}

export interface Itinerary {
  id: string
  sequenceID: string
  from: string
  to: string
  depart: string
  arrive: string
  isOverNightFlight: boolean
  duration: string
  arrivalOffset: string
  segments: Segment[]
}

export interface Segment {
  id: string
  from: string
  to: string
  aircraft: string
  aircraftCode: string
  aircraftAmenityKey: string
  stops: number
  depart: string
  arrive: string
  flightno: string
  duration: string
  bookingclass: string
  cabinclass: string
  operatingAirlineCode: string
  marketingAirlineCode: string
  operatingAirlineName: string
  marketingAirlineName: string
  filingAirline: string
  marketingAirline: string
  seatMapUri: string
  distance: number
  throughFlightLegs: ThroughFlightLeg[]
}

export interface ThroughFlightLeg {
  departureAirport: string
  arrivalAirport: string
  departureTerminal: string
  arrivalTerminal: string
  duration: string
}
