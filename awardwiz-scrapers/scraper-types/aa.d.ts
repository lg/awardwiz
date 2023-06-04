export type AAResponse = {
  error: string
  errorNumber?: number
  responseMetadata: ResponseMetadata
  products: string[]
  slices?: Slice[]
  utag: Utag
} | {
  timestamp: string
  message: string
  details: string
  errorNumber: number
  slices: undefined
}

export interface ResponseMetadata {
  account: Account
  departureDate: string
  destination: Destination
  direction: string
  duration: number
  international: boolean
  origin: Origin
  resultId: string
  roundTrip: boolean
  multiCity: boolean
  searchType: string
  sessionId: string
  solutionSet: string
  notifications: any[]
  showFlagship: boolean
  sliceCount: number
  pricedSliceIndex: number
  analytics: Analytics
  longHaulMarket: boolean
  pricedSlice: number
  selectedProductChanged: boolean
  businessPlusOffered: boolean
}

export interface Account {
  airPassBalance: number
}

export interface Destination {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface Origin {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface Analytics {
  COACH: Coach
  PREMIUM_ECONOMY: PremiumEconomy
  FIRST: First
  BUSINESS: Business
}

export interface Coach {
  cheapestAmount: number
  duration: number
  connections: number
}

export interface PremiumEconomy {
  cheapestAmount: number
  duration: number
  connections: number
}

export interface First {
  cheapestAmount: number
  duration: number
  connections: number
}

export interface Business {
  cheapestAmount: number
  duration: number
  connections: number
}

export interface Slice {
  durationInMinutes: number
  segments: Segment[]
  alerts: string[]
  cheapestPrice: CheapestPrice
  pricingDetail: PricingDetail[]
  productPricing: ProductPricing[]
  webSpecialIncluded: boolean
  economyWebSpecialIncluded: boolean
  departureDateTime: string
  arrivalDateTime: string
  origin: Origin4
  allSegmentsOperatedByAA: boolean
  destination: Destination4
  stops: number
  connectingCities: ConnectingCity[][]
  allSegmentsOA: boolean
  carrierNames: string[]
}

export interface Segment {
  alerts: string[]
  fares: any[]
  flight: Flight
  legs: Leg[]
  marriedSegmentIndex: any
  departureDateTime: string
  arrivalDateTime: string
  origin: Origin3
  destination: Destination3
  changeOfGauge: boolean
  throughFlight: boolean
}

export interface Flight {
  carrierCode: string
  carrierName: string
  flightNumber: string
}

export interface Leg {
  aircraft: Aircraft
  arrivalDateTime: string
  brazilOnTimePerformance: any
  connectionTimeInMinutes: number
  departureDateTime: string
  destination: Destination2
  durationInMinutes: number
  flight: any
  onTimePerformance: OnTimePerformance
  operationalDisclosure: string
  origin: Origin2
  productDetails: ProductDetail[]
  alerts: string[]
  amenities: string[]
  domestic: boolean
  brazilian: boolean
}

export interface Aircraft {
  code: string
  name: string
  shortName: string
}

export interface Destination2 {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface OnTimePerformance {
  performanceData: PerformanceData
  warningRequired: boolean
}

export interface PerformanceData {
  cancelRate: string
  failureRate: string
  month: string
  rate: string
}

export interface Origin2 {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface ProductDetail {
  bookingCode: string
  cabinType: string
  meals: string[]
  productType: string
  webSpecial: boolean
  flagship: boolean
  businessPlus: boolean
  alerts: string[]
}

export interface Origin3 {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface Destination3 {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface CheapestPrice {
  perPassengerDisplayTotal: PerPassengerDisplayTotal
  perPassengerAwardPoints: number
  tripType: string
  allPassengerTaxesAndFees: AllPassengerTaxesAndFees
  extendedFareCode: string
  perPassengerTaxesAndFees: PerPassengerTaxesAndFees
  productBenefits: string
  productType: string
  productTypeExt: any
  seatsRemaining: number
  solutionID: string
  allPassengerDisplayTotal: AllPassengerDisplayTotal
  productAvailable: boolean
  basicEconomyPlus: boolean
  flagship: boolean
  businessPlus: boolean
  webSpecial: boolean
  lowestPriceForProductGroup: boolean
  mustBookAtAirport: boolean
  lieFlat: boolean
  flexible: boolean
}

export interface PerPassengerDisplayTotal {
  amount: number
  currency: string
}

export interface AllPassengerTaxesAndFees {
  amount: number
  currency: string
}

export interface PerPassengerTaxesAndFees {
  amount: number
  currency: string
}

export interface AllPassengerDisplayTotal {
  amount: number
  currency: string
}

export interface PricingDetail {
  perPassengerDisplayTotal: PerPassengerDisplayTotal2
  perPassengerAwardPoints: number
  tripType: string
  allPassengerTaxesAndFees?: AllPassengerTaxesAndFees2
  extendedFareCode?: string
  perPassengerTaxesAndFees: PerPassengerTaxesAndFees2
  productBenefits: string
  productType: string
  productTypeExt: any
  seatsRemaining: number
  solutionID?: string
  allPassengerDisplayTotal?: AllPassengerDisplayTotal2
  productAvailable: boolean
  basicEconomyPlus: boolean
  flagship: boolean
  businessPlus: boolean
  webSpecial: boolean
  lowestPriceForProductGroup: boolean
  mustBookAtAirport: boolean
  lieFlat: boolean
  flexible: boolean
}

export interface PerPassengerDisplayTotal2 {
  amount: number
  currency: string
}

export interface AllPassengerTaxesAndFees2 {
  amount: number
  currency: string
}

export interface PerPassengerTaxesAndFees2 {
  amount: number
  currency: string
}

export interface AllPassengerDisplayTotal2 {
  amount: number
  currency: string
}

export interface ProductPricing {
  regularPrice: RegularPrice
  webSpecialPrice?: WebSpecialPrice
  cheapestPrice: CheapestPrice2
}

export interface RegularPrice {
  perPassengerDisplayTotal: PerPassengerDisplayTotal3
  perPassengerAwardPoints: number
  tripType: string
  allPassengerTaxesAndFees?: AllPassengerTaxesAndFees3
  extendedFareCode: string
  perPassengerTaxesAndFees: PerPassengerTaxesAndFees3
  productBenefits: string
  productType: string
  productTypeExt: any
  seatsRemaining: number
  solutionID?: string
  allPassengerDisplayTotal?: AllPassengerDisplayTotal3
  productAvailable: boolean
  basicEconomyPlus: boolean
  flagship: boolean
  businessPlus: boolean
  webSpecial: boolean
  lowestPriceForProductGroup: boolean
  mustBookAtAirport: boolean
  lieFlat: boolean
  flexible: boolean
}

export interface PerPassengerDisplayTotal3 {
  amount: number
  currency: string
}

export interface AllPassengerTaxesAndFees3 {
  amount: number
  currency: string
}

export interface PerPassengerTaxesAndFees3 {
  amount: number
  currency: string
}

export interface AllPassengerDisplayTotal3 {
  amount: number
  currency: string
}

export interface WebSpecialPrice {
  perPassengerDisplayTotal: PerPassengerDisplayTotal4
  perPassengerAwardPoints: number
  tripType: string
  allPassengerTaxesAndFees: AllPassengerTaxesAndFees4
  extendedFareCode: string
  perPassengerTaxesAndFees: PerPassengerTaxesAndFees4
  productBenefits: string
  productType: string
  productTypeExt: any
  seatsRemaining: number
  solutionID: string
  allPassengerDisplayTotal: AllPassengerDisplayTotal4
  productAvailable: boolean
  basicEconomyPlus: boolean
  flagship: boolean
  businessPlus: boolean
  webSpecial: boolean
  lowestPriceForProductGroup: boolean
  mustBookAtAirport: boolean
  lieFlat: boolean
  flexible: boolean
}

export interface PerPassengerDisplayTotal4 {
  amount: number
  currency: string
}

export interface AllPassengerTaxesAndFees4 {
  amount: number
  currency: string
}

export interface PerPassengerTaxesAndFees4 {
  amount: number
  currency: string
}

export interface AllPassengerDisplayTotal4 {
  amount: number
  currency: string
}

export interface CheapestPrice2 {
  perPassengerDisplayTotal: PerPassengerDisplayTotal5
  perPassengerAwardPoints: number
  tripType: string
  allPassengerTaxesAndFees?: AllPassengerTaxesAndFees5
  extendedFareCode: string
  perPassengerTaxesAndFees: PerPassengerTaxesAndFees5
  productBenefits: string
  productType: string
  productTypeExt: any
  seatsRemaining: number
  solutionID?: string
  allPassengerDisplayTotal?: AllPassengerDisplayTotal5
  productAvailable: boolean
  basicEconomyPlus: boolean
  flagship: boolean
  businessPlus: boolean
  webSpecial: boolean
  lowestPriceForProductGroup: boolean
  mustBookAtAirport: boolean
  lieFlat: boolean
  flexible: boolean
}

export interface PerPassengerDisplayTotal5 {
  amount: number
  currency: string
}

export interface AllPassengerTaxesAndFees5 {
  amount: number
  currency: string
}

export interface PerPassengerTaxesAndFees5 {
  amount: number
  currency: string
}

export interface AllPassengerDisplayTotal5 {
  amount: number
  currency: string
}

export interface Origin4 {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface Destination4 {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface ConnectingCity {
  city: string
  cityName: string
  code: string
  countryCode: string
  name: string
  stateCode: string
  domestic: boolean
}

export interface Utag {
  channel: string
  login_status: string
  app_build_version: string
  app_name: string
  app_region: string
  site_country: string
  site_currency: string
  site_indicator: string
  site_language: string
  spa_session_id: string
  tealium_environment: string
  tealium_profile: string
  time_stamp: string
  trueclient_ip: string
  adult_passengers: string
  route_type: string
  search_advanced_days: string
  search_cabin_type: string
  search_carrier_options: string
  search_departure_date: string
  search_destination_city: string
  search_number_of_slices: string
  search_origin_city: string
  search_return_date: string
  search_trip_duration: string
  ticket_type: string
  trip_type: string
  true_ond: string
  current_slice: string
  ita_query_result_id: string
  matrix_fare_types: string[]
  search_dates_method: string
  slice_date: string
  slice_ond: string
  lowest_award_selling_miles: string
  event_name: string
  matrix_lowest_web_special: string[]
  destination_country: string
  destination_state: string
  origin_country: string
  origin_state: string
  page_name: string
  search_product: string
}
