export interface AeroplanResponse {
  data?: Data
  dictionaries: Dictionaries
  errors?: { code: string, title: string }[]
}

export interface Dictionaries {
  location: Location
  country: Country
  airline: Airline
  aircraft: Aircraft
  flight: Flight
  currency: Currency
  anonymousTraveler: AnonymousTraveler
  fareFamilyWithServices: FareFamilyWithServices
  bookingStatus: BookingStatus
}

export type BookingStatus = Record<string, string>

export type FareFamilyWithServices = Record<string, FareFamilyWithServicesItem>

export interface FareFamilyWithServicesItem {
  hierarchy: number
  commercialFareFamily: string
  cabin: string
}

export interface AnonymousTraveler {
  "ADT-1": ADT1
}

export interface ADT1 {
  passengerTypeCode: string
}

export type Currency = Record<string, {
  name: string
  decimalPlaces: number
}>

export type Flight = Record<string, FlightSegment>

export interface FlightSegment {
  marketingAirlineCode: string
  operatingAirlineName: string
  marketingFlightNumber: string
  departure: {
    locationCode: string
    dateTime: string
  }
  arrival: {
    locationCode: string
    dateTime: string
    terminal: string
  }
  aircraftCode: string
  duration: number
  isOpenSegment: boolean
  secureFlightIndicator: boolean
}

export type Aircraft = Record<string, string>

export type Airline = Record<string, string>

export type Country = Record<string, string>

export type Location = Record<string, LocationInfo>

export interface LocationInfo {
  type: string
  cityCode: string
  cityName: string
  stateCode: string
  countryCode: string
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
  milesConversion: MilesConversion2
}

export interface MilesConversion2 {
  convertedMiles: ConvertedMiles
  remainingNonConverted: RemainingNonConverted2
}

export interface RemainingNonConverted2 {
  total: number
}

export interface TotalPrice {
  value: number
}

export interface Prices {
  unitPrices: UnitPrice[]
  totalPrices: Price[]
  isRedemption: boolean
  milesConversion: MilesConversion
}

export interface UnitPrice {
  travelerIds: string[]
  prices: Price[]
  milesConversion: MilesConversion
}

export interface MilesConversion {
  convertedMiles: ConvertedMiles
  remainingNonConverted: RemainingNonConverted
}

export interface RemainingNonConverted {
  total: number
  currencyCode: string
  totalTaxes: number
}

export interface ConvertedMiles {
  base: number
  total: number
  totalTaxes: number
}

export interface Price {
  base: number
  total: number
  currencyCode: string
  totalTaxes: number
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

export interface AvailabilityDetail {
  flightId: string
  cabin: string
  bookingClass: string
  statusCode: string
  quota: number
  mileagePercentage?: number
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
  departureDaysDifference?: number
  arrivalDaysDifference?: number
}
