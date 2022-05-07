/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UnitedFetchFlights {
  data: Data
  Error: null
}

export interface Data {
  AnonymousSearch: boolean
  ArrivalAirports: string
  CalendarLengthOfStay: number
  CallTimeBBX: string
  CallTimeDomain: string
  CallTimeProvider: string
  CartId: string
  CountryCode: string
  Characteristics: Characteristic[]
  DepartureAirports: string
  EquipmentTypes: string
  Timings: Timing[]
  LangCode: string
  LastBBXSolutionSetId: string
  LastCallDateTime: string
  LastTripIndexRequested: number
  MarketingCarriers: string
  MidPoints: string
  OperatingCarriers: string
  PageCount: number
  PageCurrent: number
  QueryType: string
  ServerName: string
  ServiceType: number
  SessionId: string
  Status: number
  TripCount: number
  RecentSearchVersion: string
  Version: string
  Calendar: Calendar
  Errors: any[]
  ITAQueries: any[]
  SpecialPricingInfo: SpecialPricingInfo
  Trips: Trip[]
  UpgradeTypes: any[]
  Upsells: any[]
  AwardCloseInFeeCheck: boolean
  LastResultId: string
}

export interface Calendar {
  SolutionSet: null
  LoadedFromCache: boolean
  LengthOfStay: number
  MaxLengthOfStay: number
  AdvancePurchase: number
  CalendarWindow: number
  TaxCurrency: null
  Months: any[]
}

export interface Characteristic {
  Code: string
  Value?: string
}

export interface SpecialPricingInfo {
  Description: string
  DisplayName: string
  ItaQueryType: string
  LastValidityMessage: string
  PIN: string
  ProgYear: string
  PromoAndPin: string
  PromoCode: string
  PromoDescription: string
  PromoDisplayText: string
  PromoID: string
  AllowedPointsOfSale: any[]
  AlternateSuggestions: any[]
  BlackoutDatesDestination: any[]
  BlackoutDatesOrigin: any[]
  Carriers: any[]
  ClassesOfService: any[]
  Companions: any[]
  DateValidationTypes: any[]
  Discounts: any[]
  DiversifyAnswers: any[]
  DiversityStrategies: any[]
  EffectiveTravelDates: any[]
  GeoCodeRestrictions: any[]
  HubRestrictions: any[]
  PaxListDetails: PaxListDetails
  PromoFields: any[]
  PromoTerms: any[]
  PromoYears: any[]
  RedeemableDates: any[]
  RequiredPassengers: any[]
  SearchMetrics: any[]
  SearchTypes: any[]
  ValidationErrors: any[]
  ValidCardTypes: any[]
  ValidDaysOfWeekRanges: any[]
  ValidPartnerCodeTypes: any[]
}

export interface PaxListDetails {
  Passengers: any[]
}

export interface Timing {
  Name: string
  TimeMilliseconds: null | string
  DTStart: null | string
}

export interface Trip {
  Destination: string
  DestinationDecoded: string
  Origin: string
  OriginDecoded: string
  BBXSession: string
  BBXSolutionSetId: string
  BBXCellIdSelected: string
  ColumnInformation: ColumnInformation
  DepartDate: Date
  DepartTime: string
  Index: number
  TripIndex: number
  ITAQueries: ITAQuery[]
  SearchFiltersIn: SearchFiltersIn
  SearchFiltersOut: SearchFiltersOut
  Flights: Flight[]
  FlightCount: number
  ChangeType: number
  OriginalChangeType: number
  OriginalMileage: number
  OriginalMileageTotal: number
  OriginalTax: number
  RequestedOrigin: null
  RequestedDestination: null
}

export interface ColumnInformation {
  Columns: Column[]
}

export interface Column {
  DataSourceLabel: string
  Description: string
  Type: string
  SubType: string
  FareContentDescription: string
  MarketingText: string
  DataSourceLabelStyle: string
  FareFamilies: string[]
  Value: string
  FareFamily: string
  DescriptionId: string
  MatrixId: number
  SortIndex: number
}

export type Flight = {
  DepartDateTime: string
  BBXHash: string
  BBXSolutionSetId: string
  BookingClassAvailability: string
  CabinCount: number
  Destination: string
  DestinationCountryCode: string
  DestinationDateTime: string
  DestinationDescription: string
  DestinationStateCode: string
  DestinationTimezoneOffset: number
  DestTimezoneOffset: number
  FlightNumber: string
  MarketingCarrier: string
  MarketingCarrierDescription: string
  MileageActual: number
  OperatingCarrier: string
  OperatingCarrierDescription: string
  OperatingCarrierDescSource: string
  Origin: string
  OriginCountryCode: string
  OriginDescription: string
  OriginStateCode: string
  OriginTimezoneOffset: number
  OrgTimezoneOffset: number
  OriginalFlightNumber: string
  PageIndex: number
  ParentFlightNumber: string
  ServiceClassCountLowest: number
  TravelMinutesTotal: number
  TravelMinutes: number
  TripIndex: number
  Connections: Connection[]
  Messages: any[]
  Products: Product[]
  StopInfos: any[]
  Warnings: Warning[]
  EquipmentDisclosures: EquipmentDisclosures
  FlightInfo: FlightInfo
  Aircraft: Aircraft
  Amenities: any[]
  Hash: string
  MerchIndex: string
  MerchTripIndex: string
  TicketStock: null
  OrderIndex?: number
  PreSortIndex?: number
  OperatingCarrierMessage?: string
  OperatingCarrierShort?: string
}

export interface Aircraft {
  Capacity: null
  CruiseSpeed: null
  Model: null
  Propulsion: null
  Wingspan: null
}

export interface Connection {
  DepartDateTime: string
  BBXHash: string
  BookingClassAvailability: string
  CabinCount: number
  ConnectTimeMinutes: number
  Destination: string
  DestinationCountryCode: string
  DestinationDateTime: string
  DestinationDescription: string
  DestinationStateCode: string
  DestinationTimezoneOffset: number
  DestTimezoneOffset: number
  FlightNumber: string
  IsConnection: boolean
  MarketingCarrier: string
  MarketingCarrierDescription: string
  MileageActual: number
  OperatingCarrier: string
  OperatingCarrierDescription: string
  OperatingCarrierDescSource: string
  Origin: string
  OriginCountryCode: string
  OriginDescription: string
  OriginStateCode: string
  OriginTimezoneOffset: number
  OrgTimezoneOffset: number
  OriginalFlightNumber: string
  ParentFlightNumber: string
  ServiceClassCountLowest: number
  TravelMinutes: number
  TripIndex: number
  Connections: any[]
  Messages: any[]
  Products: Product[]
  StopInfos: any[]
  Warnings: Warning[]
  EquipmentDisclosures: EquipmentDisclosures
  FlightInfo: FlightInfo
  Aircraft: Aircraft
  Amenities: any[]
  Hash: string
  MerchIndex: string
  TicketStock: null
}

export interface EquipmentDisclosures {
  EquipmentType: string
  EquipmentDescription: string
  IsSingleCabin: boolean
  NoBoardingAssistance: boolean
  NonJetEquipment: boolean
  WheelchairsNotAllowed: boolean
}

export interface FlightInfo {
  ActualArrivalDateTime: null
  ActualDepartureDateTime: null
  EstimatedArrivalDateTime: string
  EstimatedDepartureDateTime: string
  MinutesDelayed: null
  ScheduledArrivalDateTime: string
  ScheduledDepartureDateTime: string
  StatusCode: null
  StatusMessage: null
}

export interface Product {
  BookingCode: string
  BookingClassAvailability?: string
  CabinTypeText: string
  CabinType?: string
  Description?: string
  Mileage?: number
  ProductId?: string
  ProductPath: string
  ProductSubtype: string
  ProductType: string
  SolutionId?: string
  Prices: ReferenceFare[]
  MealDescription?: string
  CabinTypeCode?: string
  DisplayOrder: number
  NumberOfPassengers: number
  ColumnId: number
  TripIndex: number
  SegmentNumber: number
  IsOverBooked: number
  IsDynamicallyPriced: number
  Selected: boolean
  MarriedSegmentIndex: number
  FareFamily: string
  HasMultipleClasses: boolean
  SortIndex: number
  BookingCount?: number
  MerchIndex?: string
  Context?: Context
  AwardType?: string
  BestMatchSortOrder?: number
  CrossCabinMessaging?: string
}

export interface Context {
  RefFareBookingCode: string
  ReferenceFare: ReferenceFare
  ItaMiles: string
  NgrpMiles: string
  SubProducts: null
  NGRP: boolean
  DynamicCode: string
  FareFlavour: string
  FareFamily: null
  PriceDesignator: string
  DiagnosticId: string
  Rank: number
  PaxPrices: PaxPrice[]
  StopOverCode: string
}

export interface PaxPrice {
  PaxType: string
  Miles: number
  DynamicCode: string
}

export interface ReferenceFare {
  Currency: null | string
  CurrencyAllPax: null
  Amount: number
  AmountAllPax: number
  AmountBase: number
  PricingType: null | string
  PricingDetails: null
  ID?: string
}

export interface Warning {
  Title: string
  Key: string
  Hidden: boolean
  Messages: string[]
  Stops: null
}

export interface ITAQuery {
  QueryDateTime: string
  TripIndex: number
  search: Search
  result: null
  summarize: null
}

export interface Search {
  api: string
  requestTags: RequestTags
  inputs: Inputs
  key: string
  name: string
  qpx: string
  requestId: null
  session: null | string
  version: string
  qpxTestData: null
  summarizer: number[]
  solutionSet?: string
}

export interface Inputs {
  api: null
  bookingCode: null
  bookingSolution: null
  enumerationControl: null
  fareReduction: null
  fareType: string
  pageNum: string
  pageSize: string
  paxArray: PaxArray[]
  permittedBookingCodes: null
  reissue: null
  residency: string
  slice: Slouse[]
  sliceIndex: string
  solutionSet: null | string
  sort: string
  test: null
  testCarriers: null
  upgrade: null
  useTestSchedules: null
  useTestAvailability: null
  includeReference: boolean
  isUnaccompaniedMinor: null
  pricing: Pricing
  maxRows: null
  pointOfSale: null
  pnr: null
}

export interface PaxArray {
  ptcOverride: null
  birthDate: null
  age: number
  paxGroup: string
  gender: null
  nationality: Nationality[]
  residency: Nationality[]
}

export interface Nationality {
  country: null
}

export interface Pricing {
  fare: null
  faring: null
  modifiers: null
  restrictions: StopPrice
  tax: null
}

export interface StopPrice {
}

export interface Slouse {
  hash: null
  origin: string
  destination: string
  date: Date
  cabin: null
  maxStopCount: null
  stop: null
  departure: null
  departureTime: null
  cell: null
  ext: null
  flightCode: null
  saleTaxTotal: null
  segment: null
  tax: null
  taxes: null
  index: null
  stopCount: null
  daysBefore: null
  daysAfter: null
}

export interface RequestTags {
  tag: string
}

export interface SearchFiltersIn {
  CabinCountMin: number
  CabinCountMax: number
  CarrierDefault: boolean
  CarrierExpress: boolean
  CarrierPartners: boolean
  CarrierStar: boolean
  DurationMin: number
  DurationMax: number
  DurationStopMin: number
  DurationStopMax: number
  FareFamily: string
  PriceMin: number
  PriceMinCurrency: string
  PriceMax: number
  PriceMaxCurrency: string
  StopCountExcl: number
  StopCountMin: number
  StopCountMax: number
  AirportsDestinationList: any[]
  AirportsOriginList: any[]
  AirportsStopList: any[]
  AirportsStopToAvoidList: any[]
  CarriersMarketingList: any[]
  CarriersOperatingList: any[]
  EquipmentList: any[]
  FareFamilyFilters: any[]
  Warnings: any[]
  ShopIndicators: null
}

export interface SearchFiltersOut {
  AirportsOrigin: string
  AirportsDestination: string
  AirportsStop: string
  CabinCountMin: number
  CabinCountMax: number
  CarrierDefault: boolean
  CarrierExpress: boolean
  CarrierPartners: boolean
  CarrierStar: boolean
  CarriersMarketing: string
  CarriersOperating: string
  DurationMin: number
  DurationMax: number
  DurationStopMin: number
  DurationStopMax: number
  EquipmentCodes: string
  EquipmentTypes: string
  MinDepDate: string
  MaxDepDate: string
  MinArrivalDate: string
  MaxArrivalDate: string
  PriceMin: number
  PriceMinCurrency: string
  PriceMax: number
  PriceMaxCurrency: string
  StopCountExcl: number
  StopCountMin: number
  StopCountMax: number
  TimeDepartMin: string
  TimeDepartMax: string
  TimeArrivalMin: string
  TimeArrivalMax: string
  AirportsDestinationList: List[]
  AirportsOriginList: List[]
  AirportsStopList: List[]
  AirportsStopToAvoidList: any[]
  CarriersMarketingList: List[]
  CarriersOperatingList: List[]
  EquipmentList: List[]
  FareFamilyFilters: FareFamilyFilter[]
  FareFamilies: FareFamilies
  StopPrices: StopPrice[]
  Warnings: string[]
  MaxConnectTimeMinutes: number
  MinConnectTimeMinutes: number
  ShopIndicators: null
}

export interface List {
  Code: string
  Description: null | string
  Currency: null | string
  Amount: null | string
}

export interface FareFamilies {
  fareFamily: FareFamily[]
}

export interface FareFamily {
  fareFamily: string
  currencyCode: string
  maxMileage: number
  maxPrice: null
  maxPriceValue: number
  minMileage: number
  minPrice: null
  minPriceValue: number
  minPriceInSummary: boolean
}

export interface FareFamilyFilter {
  FareFamily: string
  FareFamilyInfo: FareFamily
  SliceDestinations: Slice[]
  SliceOrigins: Slice[]
  SliceStops: SliceStop[]
}

export interface Slice {
  currency: string
  destination?: string
  fareFamily: string
  minMileage: string
  minMileageInSummary: boolean
  minPrice: null
  minPriceValue: number
  minPriceInSummary: boolean
  airport: null
  origin?: string
}

export interface SliceStop {
  currency: string
  fareFamily: string
  minMileage: string
  stopCount: string
  minPrice: null
  minPriceValue: number
  minPriceInSummary: boolean
}
