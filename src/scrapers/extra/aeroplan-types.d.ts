export interface AeroplanFetchFlights {
  data: Data
  dictionaries: Dictionaries
}

export interface Data {
  airBoundGroups: AirBoundGroup[]
}

export interface AirBoundGroup {
  boundDetails: BoundDetails
  airBounds: AirBound[]
}

export interface AirBound {
  airBoundId: string
  fareFamilyCode: string
  availabilityDetails: AvailabilityDetail[]
  fareInfos: FareInfo[]
  prices: Prices
  airOffer: AirOffer
  isMixedCabin?: boolean
  isCheapestOffer?: boolean
}

export interface AirOffer {
  totalPrice: TotalPrice
  prices: Prices
  milesConversion: AirOfferMilesConversion
}

export interface AirOfferMilesConversion {
  convertedMiles: ConvertedMiles
  remainingNonConverted: RemainingNonConverted
}

export interface ConvertedMiles {
  base: number
  total: number
  totalTaxes: number
}

export interface RemainingNonConverted {
  total: number
}

export interface Prices {
  unitPrices: UnitPrice[]
  totalPrices: RemainingNonConvertedElement[]
  isRedemption: boolean
  milesConversion: PricesMilesConversion
}

export interface PricesMilesConversion {
  convertedMiles: ConvertedMiles
  remainingNonConverted: RemainingNonConvertedElement
}

export interface RemainingNonConvertedElement {
  total: number
  currencyCode: string
  totalTaxes: number
  base?: number
}

export interface UnitPrice {
  travelerIds: string[]
  prices: RemainingNonConvertedElement[]
  milesConversion: PricesMilesConversion
}

export interface TotalPrice {
  value: number
}

export interface AvailabilityDetail {
  flightId: string
  cabin: string
  bookingClass: string
  statusCode: string
  quota: number
  mileagePercentage?: number
}

export interface FareInfo {
  fareType: string
  fareClass: string
  pricedPassengerTypeCodes: string[]
  travelerIds: string[]
  ticketDesignator: string
  corporateCode: string
  flightIds: string[]
}

export interface BoundDetails {
  originLocationCode: string
  destinationLocationCode: string
  duration: number
  ranking: number
  segments: Segment[]
}

export interface Segment {
  flightId: string
  connectionTime?: number
  arrivalDaysDifference?: number
  departureDaysDifference?: number
}

export interface Dictionaries {
  location: Location
  country: string
  airline: string
  aircraft: { [key: string]: string }
  flight: { [key: string]: SegAC }
  currency: Currency
  anonymousTraveler: AnonymousTraveler
  fareFamilyWithServices: FareFamilyWithServices
  bookingStatus: BookingStatus
}

export interface AnonymousTraveler {
  "ADT-1": ADT1
}

export interface ADT1 {
  passengerTypeCode: string
}

export interface BookingStatus {
  HK: Hk
}

export interface Hk {
  name: string
}

export interface Currency {
  CAD: CAD
}

export interface CAD {
  name: string
  decimalPlaces: number
}

export interface FareFamilyWithServices {
  EXECLOW: Execflex
  PYFLEX: Execflex
  FLEX: Execflex
  PYLOW: Execflex
  LATITUDE: Execflex
  STANDARD: Execflex
  EXECFLEX: Execflex
}

export interface Execflex {
  hierarchy: number
  commercialFareFamily: string
  cabin: string
}

export interface Arrival {
  locationCode: string
  dateTime: string
  terminal: string
}

export interface SegAC {
  marketingAirlineCode: string
  operatingAirlineCode?: string
  marketingFlightNumber: string
  departure: Departure
  arrival: Arrival
  aircraftCode: string
  duration: number
  isOpenSegment: boolean
  secureFlightIndicator: boolean
  operatingAirlineName?: string
}

export interface Departure {
  locationCode: string
  dateTime: string
}

export interface Location {
  YUL: Den
  PHX: Den
  YYC: Den
  YVR: Den
  YEA: Den
  YTO: Den
  YEG: Den
  YYZ: Den
  YMQ: Den
  DEN: Den
  SFO: Den
  LAS: Den
}

export interface Den {
  type: string
  airportName?: string
  cityCode: string
  cityName: string
  stateCode: string
  countryCode: string
}
