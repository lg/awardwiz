export interface FR24SearchResult {
  result: Result
  _api: API
}

export interface API {
  copyright: string
  legalNotice: string
}

export interface Result {
  request: Request
  response: Response
}

export interface Request {
  query: string
  limit: number
  format: string
  origin: string
  destination: string
  fetchBy: string
  callback: null
  token: null
  pk: null
}

export interface Response {
  flight: Flight
}

export interface Flight {
  item: Item
  timestamp: number
  data: Datum[]
}

export interface Datum {
  identification: Identification
  status: DatumStatus
  aircraft: Aircraft | null
  airline: Airline
  airport: Airport
  time: Time
}

export interface Aircraft {
  model: Model
  registration: string
  country: AircraftCountry
}

export interface AircraftCountry {
  id: number
  name: string
  alpha2: string
  alpha3: string
}

export interface Model {
  code: string
  text: string
}

export interface Airline {
  name: string
  code: Code
}

export interface Code {
  iata: string
  icao: string
}

export interface Airport {
  origin: Destination
  destination: Destination
  real: Destination | null
}

export interface Destination {
  name: string
  code: Code
  position: Position
  timezone: Timezone
}

export interface Position {
  latitude: number
  longitude: number
  country: PositionCountry
  region: Region
}

export interface PositionCountry {
  name: string
  code: string
  id: number
}

export interface Region {
  city: string
}

export interface Timezone {
  name: string
  offset: number
  abbr: string
  abbrName: string
  isDst: boolean
}

export interface Identification {
  id: null | string
  row: number
  number: Number
  callsign: null | string
  codeshare: null
}

export interface Number {
  default: null | string
  alternative: null
}

export interface DatumStatus {
  live: boolean
  text: string
  icon: null | string
  estimated: null
  ambiguous: boolean
  generic: Generic
}

export interface Generic {
  status: GenericStatus
  eventTime: EventTime
}

export interface EventTime {
  utc: number | null
  local: number | null
}

export interface GenericStatus {
  text: string
  type: string
  color: string
  diverted: null | string
}

export interface Time {
  scheduled: Estimated
  real: Estimated
  estimated: Estimated
  other: Other
}

export interface Estimated {
  departure: number | null
  arrival: number | null
}

export interface Other {
  eta: number | null
}

export interface Item {
  current: number
}
