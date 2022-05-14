export interface Result {
  data: Data
  success: boolean
  notifications: Notifications | null
  uiMetadata: UiMetadata
}

interface Notifications {
  formErrors: FormError[]
}

interface FormError {
  code: string
}

interface Data {
  searchResults: SearchResults
}

interface SearchResults {
  fareSummary: FareSummary[]
  airProducts: AirProduct[]
  promoToken: null
}

interface AirProduct {
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
  currencyCode: null
  details: Detail[]
  lowestFare: LowestFare
}

interface Detail {
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
  fareProducts: FareProducts
}

interface FareProducts {
  ADULT: Adult
}

interface Adult {
  BUSRED: Red
  ANYRED: Red
  WGARED: Red
}

export interface Red {
  productId: string
  passengerType: string
  availabilityStatus: string
  originalFare: null
  fare: Fare
  waivedFare: null
}

interface Fare {
  baseFare: MinimumFare
  totalTaxesAndFees: MinimumFare
  totalFare: MinimumFare
  seatsLeft?: number
}

interface MinimumFare {
  value: string
  currencyCode: string
}

interface Segment {
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

interface StopsDetail {
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

interface LowestFare {
  fareFamily: string
  currencyCode: string
  value: string
}

interface FareSummary {
  fareFamily: string
  minimumFare: MinimumFare
}

interface UiMetadata {
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
