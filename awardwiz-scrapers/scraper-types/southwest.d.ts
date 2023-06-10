export interface SouthwestResponse {
  data?: Data
  success: boolean
  notifications?: Notifications
  uiMetadata: UiMetadata
  code?: number
}

export interface Notifications {
  formErrors?: { code: string }[]
  fieldErrors?: { code: string }[]
}

export interface Data {
  searchResults?: SearchResults
}

export interface SearchResults {
  fareSummary: FareSummary[]
  airProducts: AirProduct[]
  promoToken: any
}

export interface FareSummary {
  fareFamily: string
  minimumFare: MinimumFare
}

export interface MinimumFare {
  value: string
  currencyCode: string
}

export interface AirProduct {
  originationAirportCode: string
  destinationAirportCode: string
  fastestDuration: string
  containsAvailability: boolean
  containsNonstop: boolean
  containsBeforeNoon: boolean
  containsNoonToSix: boolean
  containsAfterSix: boolean
  containsTimeOfDay: boolean
  containsStops: boolean
  containsDirect: boolean
  currencyCode: any
  details: Detail[]
  lowestFare: LowestFare
}

export interface Detail {
  originationAirportCode: string
  destinationAirportCode: string
  departureTime: string
  arrivalTime: string
  nextDay: boolean
  totalDuration: number
  flightNumbers: string[]
  filterTags: string[]
  departureDateTime: string
  arrivalDateTime: string
  segments: Segment[]
  fareProducts?: FareProducts
}

export interface Segment {
  originationAirportCode: string
  destinationAirportCode: string
  flightNumber: string
  duration: string
  numberOfStops: number
  departureTime: string
  arrivalTime: string
  departureDateTime: string
  arrivalDateTime: string
  operatingCarrierCode: string
  marketingCarrierCode: string
  aircraftEquipmentType: string
  wifiOnBoard: boolean
  stopsDetails: StopsDetail[]
}

export interface StopsDetail {
  originationAirportCode: string
  destinationAirportCode: string
  flightNumber: string
  legDuration: number
  stopDuration: number
  departureTime: string
  arrivalTime: string
  departureDateTime: string
  arrivalDateTime: string
  changePlanes?: boolean
}

export interface FareProducts {
  ADULT: Adult
}

export interface Adult {
  BUSRED: Busred
  ANYRED: Anyred
  WGARED: Wgared
}

export interface Busred {
  productId: string
  passengerType: string
  availabilityStatus: string
  originalFare: any
  fare: Fare
  waivedFare: any
}

export interface Fare {
  baseFare: BaseFare
  totalTaxesAndFees: TotalTaxesAndFees
  totalFare: TotalFare
}

export interface BaseFare {
  value: string
  currencyCode: string
}

export interface TotalTaxesAndFees {
  value: string
  currencyCode: string
}

export interface TotalFare {
  value: string
  currencyCode: string
}

export interface Anyred {
  productId: string
  passengerType: string
  availabilityStatus: string
  originalFare: any
  fare: Fare2
  waivedFare: any
}

export interface Fare2 {
  baseFare: BaseFare2
  totalTaxesAndFees: TotalTaxesAndFees2
  totalFare: TotalFare2
  seatsLeft?: number
}

export interface BaseFare2 {
  value: string
  currencyCode: string
}

export interface TotalTaxesAndFees2 {
  value: string
  currencyCode: string
}

export interface TotalFare2 {
  value: string
  currencyCode: string
}

export interface Wgared {
  productId: string
  passengerType: string
  availabilityStatus: string
  originalFare: any
  fare: Fare3
  waivedFare: any
}

export interface Fare3 {
  baseFare: BaseFare3
  totalTaxesAndFees: TotalTaxesAndFees3
  totalFare: TotalFare3
  seatsLeft?: number
}

export interface BaseFare3 {
  value: string
  currencyCode: string
}

export interface TotalTaxesAndFees3 {
  value: string
  currencyCode: string
}

export interface TotalFare3 {
  value: string
  currencyCode: string
}

export interface LowestFare {
  fareFamily: string
  currencyCode: string
  value: string
}

export interface UiMetadata {
  paymentInfoService: boolean
  discountServiceMaintenanceModeForDotcom: boolean
  discountServiceMaintenanceModeForSwabiz: boolean
  cvvForSavedCreditCard: boolean
  cvvForSavedCreditCardSwabiz: boolean
  carCrossSellEnabled: boolean
  cvvForEnteredCreditCardSwabiz: boolean
  chapiVersion: string
  airFirstTimeFlyer: boolean
  rapidRewardsMaintenance: boolean
  earlyBirdCrossSellEnabled: boolean
  proxyLogout: boolean
  payPalService: boolean
  fundsService: boolean
}
