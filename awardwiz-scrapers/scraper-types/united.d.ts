/* eslint-disable @typescript-eslint/no-empty-interface */
export interface UnitedResponse {
  data?: Data
  Error: any
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

export interface Characteristic {
  Code: string
  Value?: string
}

export interface Timing {
  Name: string
  TimeMilliseconds?: string
  DTStart?: string
}

export interface Calendar {
  SolutionSet: any
  LoadedFromCache: boolean
  LengthOfStay: number
  MaxLengthOfStay: number
  AdvancePurchase: number
  CalendarWindow: number
  TaxCurrency: any
  Months: any[]
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

export interface Trip {
  Destination: string
  DestinationDecoded: string
  Origin: string
  OriginDecoded: string
  BBXSession: string
  BBXSolutionSetId: string
  BBXCellIdSelected: string
  ColumnInformation: ColumnInformation
  DepartDate: string
  DepartTime: string
  Index: number
  TripIndex: number
  ITAQueries: Itaquery[]
  SearchFiltersIn: SearchFiltersIn
  SearchFiltersOut: SearchFiltersOut
  Flights: Flight[]
  FlightCount: number
  ChangeType: number
  OriginalChangeType: number
  OriginalMileage: number
  OriginalMileageTotal: number
  OriginalTax: number
  RequestedOrigin: any
  RequestedDestination: any
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

export interface Itaquery {
  QueryDateTime: string
  TripIndex: number
  search: Search
  result: any
  summarize: any
}

export interface Search {
  api: string
  requestTags: RequestTags
  inputs: Inputs
  key: string
  name: string
  qpx: string
  requestId: any
  session?: string
  version: string
  qpxTestData: any
  summarizer: number[]
  solutionSet?: string
}

export interface RequestTags {
  tag: string
}

export interface Inputs {
  api: any
  bookingCode: any
  bookingSolution: any
  enumerationControl: any
  fareReduction: any
  fareType: string
  pageNum: string
  pageSize: string
  paxArray: PaxArray[]
  permittedBookingCodes: any
  reissue: any
  residency: string
  slice: Louse[]
  sliceIndex: string
  solutionSet?: string
  sort: string
  test: any
  testCarriers: any
  upgrade: any
  useTestSchedules: any
  useTestAvailability: any
  includeReference: boolean
  isUnaccompaniedMinor: any
  pricing: Pricing
  maxRows: any
  pointOfSale: any
  pnr: any
}

export interface PaxArray {
  ptcOverride: any
  birthDate: any
  age: number
  paxGroup: string
  gender: any
  nationality: Nationality[]
  residency: Residency[]
}

export interface Nationality {
  country: any
}

export interface Residency {
  country: any
}

export interface Louse {
  hash: any
  origin: string
  destination: string
  date: string
  cabin: any
  maxStopCount: any
  stop: any
  departure: any
  departureTime: any
  cell: any
  ext: any
  flightCode: any
  saleTaxTotal: any
  segment: any
  tax: any
  taxes: any
  index: any
  stopCount: any
  daysBefore: any
  daysAfter: any
}

export interface Pricing {
  fare: any
  faring: any
  modifiers: any
  restrictions: Restrictions
  tax: any
}

export interface Restrictions {}

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
  ShopIndicators: any
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
  AirportsDestinationList: AirportsDestinationList[]
  AirportsOriginList: AirportsOriginList[]
  AirportsStopList: AirportsStopList[]
  AirportsStopToAvoidList: any[]
  CarriersMarketingList: CarriersMarketingList[]
  CarriersOperatingList: CarriersOperatingList[]
  EquipmentList: EquipmentList[]
  FareFamilyFilters: FareFamilyFilter[]
  FareFamilies: FareFamilies
  StopPrices: StopPrice[]
  Warnings: string[]
  MaxConnectTimeMinutes: number
  MinConnectTimeMinutes: number
  ShopIndicators: any
}

export interface AirportsDestinationList {
  Code: string
  Description: string
  Currency: string
  Amount: string
}

export interface AirportsOriginList {
  Code: string
  Description: string
  Currency: string
  Amount: string
}

export interface AirportsStopList {
  Code: string
  Description: string
  Currency: any
  Amount: any
}

export interface CarriersMarketingList {
  Code: string
  Description: string
  Currency: any
  Amount: any
}

export interface CarriersOperatingList {
  Code: string
  Description: any
  Currency: any
  Amount: any
}

export interface EquipmentList {
  Code: string
  Description: string
  Currency: any
  Amount: any
}

export interface FareFamilyFilter {
  FareFamily: string
  FareFamilyInfo: FareFamilyInfo
  SliceDestinations: SliceDestination[]
  SliceOrigins: SliceOrigin[]
  SliceStops: SliceStop[]
}

export interface FareFamilyInfo {
  fareFamily: string
  currencyCode: string
  maxMileage: number
  maxPrice: any
  maxPriceValue: number
  minMileage: number
  minPrice: any
  minPriceValue: number
  minPriceInSummary: boolean
}

export interface SliceDestination {
  currency: string
  destination: string
  fareFamily: string
  minMileage: string
  minMileageInSummary: boolean
  minPrice: any
  minPriceValue: number
  minPriceInSummary: boolean
  airport: any
}

export interface SliceOrigin {
  currency: string
  origin: string
  fareFamily: string
  minMileage: string
  minMileageInSummary: boolean
  minPrice: any
  minPriceValue: number
  minPriceInSummary: boolean
  airport: any
}

export interface SliceStop {
  currency: string
  fareFamily: string
  minMileage: string
  stopCount: string
  minPrice: any
  minPriceValue: number
  minPriceInSummary: boolean
}

export interface FareFamilies {
  fareFamily: FareFamily[]
}

export interface FareFamily {
  fareFamily: string
  currencyCode: string
  maxMileage: number
  maxPrice: any
  maxPriceValue: number
  minMileage: number
  minPrice: any
  minPriceValue: number
  minPriceInSummary: boolean
}

export interface StopPrice {}

export interface Flight {
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
  Products: Product2[]
  StopInfos: any[]
  Warnings: Warning2[]
  EquipmentDisclosures: EquipmentDisclosures2
  FlightInfo: FlightInfo2
  Aircraft: Aircraft2
  Amenities: any[]
  Hash: string
  MerchIndex: string
  MerchTripIndex: string
  TicketStock: any
  OrderIndex?: number
  PreSortIndex?: number
  OperatingCarrierMessage?: string
  OperatingCarrierShort?: string
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
  TicketStock: any
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
  Prices: any[]
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
}

export interface Warning {
  Title: string
  Key: string
  Hidden: boolean
  Messages: string[]
  Stops: any
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
  ActualArrivalDateTime: any
  ActualDepartureDateTime: any
  EstimatedArrivalDateTime: string
  EstimatedDepartureDateTime: string
  MinutesDelayed: any
  ScheduledArrivalDateTime: string
  ScheduledDepartureDateTime: string
  StatusCode: any
  StatusMessage: any
}

export interface Aircraft {
  Capacity: any
  CruiseSpeed: any
  Model: any
  Propulsion: any
  Wingspan: any
}

export interface Product2 {
  BookingCode: string
  BookingClassAvailability?: string
  CabinTypeText: string
  CabinType?: string
  Description?: string
  MerchIndex: string
  Mileage?: number
  ProductId?: string
  ProductPath: string
  ProductSubtype: string
  ProductType: string
  SolutionId?: string
  Context?: Context
  Prices: Price[]
  MealDescription?: string
  AwardType?: string
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
  BestMatchSortOrder?: number
  CrossCabinMessaging?: string
  BookingCount?: number
}

export interface Context {
  RefFareBookingCode: string
  ReferenceFare: ReferenceFare
  ItaMiles: string
  NgrpMiles: string
  SubProducts: any
  NGRP: boolean
  DynamicCode: string
  FareFlavour: string
  FareFamily: any
  PriceDesignator: string
  DiagnosticId: string
  Rank: number
  PaxPrices: PaxPrice[]
  StopOverCode: string
}

export interface ReferenceFare {
  Currency: any
  CurrencyAllPax: any
  Amount: number
  AmountAllPax: number
  AmountBase: number
  PricingType: any
  PricingDetails: any
  ID?: string
}

export interface PaxPrice {
  PaxType: string
  Miles: number
  DynamicCode: string
}

export interface Price {
  Currency: string
  CurrencyAllPax: any
  Amount: number
  AmountAllPax: number
  AmountBase: number
  PricingType: string
  PricingDetails: any
}

export interface Warning2 {
  Title: string
  Key: string
  Hidden: boolean
  Messages: string[]
  Stops: any
}

export interface EquipmentDisclosures2 {
  EquipmentType: string
  EquipmentDescription: string
  IsSingleCabin: boolean
  NoBoardingAssistance: boolean
  NonJetEquipment: boolean
  WheelchairsNotAllowed: boolean
}

export interface FlightInfo2 {
  ActualArrivalDateTime: any
  ActualDepartureDateTime: any
  EstimatedArrivalDateTime: string
  EstimatedDepartureDateTime: string
  MinutesDelayed: any
  ScheduledArrivalDateTime: string
  ScheduledDepartureDateTime: string
  StatusCode: any
  StatusMessage: any
}

export interface Aircraft2 {
  Capacity: any
  CruiseSpeed: any
  Model: any
  Propulsion: any
  Wingspan: any
}
