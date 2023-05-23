export interface FlightRadar24Response {
  result?: Result
  errors?: Errors
  _api?: Api
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
  callback: any
  token: any
  pk: any
}

export interface Response {
  flight: Flight
}

export interface Flight {
  item: Item
  timestamp: number
  data: Daum[]
}

export interface Item {
  current: number
}

export interface Daum {
  identification: Identification
  status: Status
  aircraft?: Aircraft
  airline?: Airline
  airport: Airport
  time: Time
}

export interface Identification {
  id?: string
  row: number
  number: number
  callsign?: string
  codeshare: any
}

export interface Number {
  default: string
  alternative: any
}

export interface Status {
  live: boolean
  text: string
  icon?: string
  estimated: any
  ambiguous: boolean
  generic: Generic
}

export interface Generic {
  status: Status2
  eventTime: EventTime
}

export interface Status2 {
  text: string
  type: string
  color: string
  diverted: any
}

export interface EventTime {
  utc?: number
  local?: number
}

export interface Aircraft {
  model: Model
  registration: string
  country: Country
}

export interface Model {
  code: string
  text: string
}

export interface Country {
  id: number
  name: string
  alpha2: string
  alpha3: string
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
  origin: Origin
  destination: Destination
  real: any
}

export interface Origin {
  name: string
  code: Code2
  position: Position
  timezone: Timezone
}

export interface Code2 {
  iata: string
  icao: string
}

export interface Position {
  latitude: number
  longitude: number
  country: Country2
  region: Region
}

export interface Country2 {
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

export interface Destination {
  name: string
  code: Code3
  position: Position2
  timezone: Timezone2
}

export interface Code3 {
  iata: string
  icao: string
}

export interface Position2 {
  latitude: number
  longitude: number
  country: Country3
  region: Region2
}

export interface Country3 {
  name: string
  code: string
  id: number
}

export interface Region2 {
  city: string
}

export interface Timezone2 {
  name: string
  offset: number
  abbr: string
  abbrName: string
  isDst: boolean
}

export interface Time {
  scheduled: Scheduled
  real: Real
  estimated: Estimated
  other: Other
}

export interface Scheduled {
  departure: number
  arrival: number
}

export interface Real {
  departure?: number
  arrival?: number
}

export interface Estimated {
  departure?: number
  arrival?: number
}

export interface Other {
  eta?: number
}

export interface Errors {
  message: string
  errors: Errors2
}

export interface Errors2 {
  parameters: Parameters
}

export interface Parameters {
  origin: Origin2
}

export interface Origin2 {
  regexNotMatch: RegexNotMatch
}

export interface RegexNotMatch {
  codeNotMatch: string
}

export interface Api {
  copyright: string
  legalNotice: string
}
