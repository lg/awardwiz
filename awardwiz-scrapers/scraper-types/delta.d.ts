/* eslint-disable @typescript-eslint/no-empty-interface */

export interface DeltaResponse {
  badgesInfo: BadgesInfo
  tripOriginAirportCode: string
  tripOriginCityName: string
  tripDestinationAirportCode: string
  tripDestinationCityName: string
  currencyCode: string
  currencySymbol: string
  searchCriteria: SearchCriteria
  sessionTimeoutLimit: number
  sessionTimeoutModalLimit: number
  sessionTimeoutRemainingLimit: number
  customer: Customer
  customerReferenceId: string
  shopType: string
  tripType: string
  offerCall: string
  offerRequestId: string
  offerResponseId: string
  badgeInfoMap: BadgeInfoMap
  showCurrencyDisclaimer: boolean
  availableBrandId: AvailableBrandId[]
  page: Page
  itinerary: Itinerary[]
  filter: Filter
  sortOption: SortOption[]
  availableSearchOptionId: any[]
  links: Link3[]
  shopTypeOptions: ShopTypeOption2[]
  dynamicBannerRequest: DynamicBannerRequest
  nearbyAirports: NearbyAirports
  companionUpgrade: boolean
  airportMarketType: string
  metaData: MetaData
  amexCompanionCert: boolean
  hasTravelPolicy: boolean

  shoppingError?: {
    error?: {
      message: {
        code: string
        message: string
        errorKey: string
        reasonCode: string
        reasonMsg: string
        errorTags: object
      }
    }
  }
  secondaryShoppingError?: {
    error?: {
      message: {
        code: string
        message: string
        errorKey: string
        reasonCode: string
        reasonMsg: string
        errorTags: unknown
      }
    }
  }
}

export interface BadgesInfo {
  badges: Badge[]
}

export interface Badge {
  badgeText: BadgeText
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
  badgeURL?: string
  mobileBadgeIcon?: MobileBadgeIcon
  badgeIcon?: string
  travelStartDate?: string
  travelEndDate?: string
  searchStartDate?: string
  searchEndDate?: string
}

export interface BadgeText {
  hasMarkup: boolean
  text: string
}

export interface MobileBadgeIcon {
  type: string
  url: string
}

export interface SearchCriteria {
  request: Request
  fareBrandsByMiles: FareBrandsByMile[]
  fareBrandsByMoney: FareBrandsByMoney[]
  defaultsMap: DefaultsMap
  paxDefaults: PaxDefaults
  radiusDefaults: RadiusDefault[]
  shopTypeOptions: ShopTypeOption[]
  flexOptions: FlexOption[]
  journeyTypeOptions: JourneyTypeOption[]
  fareClassOptions: FareClassOption[]
  hasCoporateAgreement: boolean
  disableTripType: boolean
  disablePaxDropDown: boolean
  disableShowPriceIn: boolean
  disableBestFaresFor: boolean
  disableMeetingCode: boolean
  disableRefundableFares: boolean
  disableNearbyAirport: boolean
  disableEdocLink: boolean
  disableFlexibleDates: boolean
  useEdocDefaultPaxCount: boolean
  edocDefaultPaxCount: number
  edocMinPaxCount: number
  edocMaxPaxCount: number
  tripOriginCityName: string
  tripDestinationCityName: string
  corporateSearch: boolean
  meetingEventSearch: boolean
  edocSearch: boolean
}

export interface Request {
  bestFare: string
  action: string
  destinationAirportRadius: DestinationAirportRadius
  deltaOnlySearch: boolean
  meetingEventCode: string
  originAirportRadius: OriginAirportRadius
  passengers: Passenger[]
  searchType: string
  segments: Segment[]
  shopType: string
  tripType: string
  priceType: string
  priceSchedule: string
  awardTravel: boolean
  refundableFlightsOnly: boolean
  nonstopFlightsOnly: boolean
  datesFlexible: boolean
  flexCalendar: boolean
  flexAirport: boolean
  upgradeRequest: boolean
  corporateSMTravelType: string
  pageName: string
  cacheKey: string
  requestPageNum: string
  sortableOptionId: string
  selectedSolutions: any[]
  actionType: string
  initialSearchBy: InitialSearchBy
}

export interface DestinationAirportRadius {
  unit: string
  measure: number
}

export interface OriginAirportRadius {
  unit: string
  measure: number
}

export interface Passenger {
  type: string
  count: number
}

export interface Segment {
  departureDate: string
  destination: string
  origin: string
}

export interface InitialSearchBy {
  fareFamily: string
  meetingEventCode: string
  refundable: boolean
  flexAirport: boolean
  flexDate: boolean
  flexDaysWeeks: string
}

export interface FareBrandsByMile {
  brandID: string
  brandName: string
}

export interface FareBrandsByMoney {
  brandID: string
  brandName: string
}

export interface DefaultsMap {
  flexairportsearch: string
  flexCheck: string
  refundableFlightsOnly: string
  calendarsearch: string
  deltaAndPartners: string
  deltaOnlySearch: string
  nonstopFlightsOnly: string
}

export interface PaxDefaults {
  paxTypeList: PaxTypeList[]
}

export interface PaxTypeList {
  paxCode: string
  paxDesc: string
  defaultCount: number
  maximumPaxCount: number
}

export interface RadiusDefault {
  unit: string
  measure: number
  value: string
  isDefaulted: boolean
}

export interface ShopTypeOption {
  value: string
  isDefaulted: boolean
}

export interface FlexOption {
  value: string
  isDefaulted: boolean
}

export interface JourneyTypeOption {
  value: string
  isDefaulted: boolean
}

export interface FareClassOption {
  code: string
  description: string
}

export interface Customer {
  pwmDomesticFlag: boolean
  pwmInternationalFlag: boolean
  loggedInStatus: boolean
}

export interface BadgeInfoMap {
  LOWEST: Lowest
  NEWAIRPORT: Newairport
  IN_POLICY: InPolicy
  VTLFLT: Vtlflt
  Current_Flight: CurrentFlight
  NOT_ALLOWED: NotAllowed
  TRNSVC: Trnsvc
  FASTEST: Fastest
  OUT_POLICY: OutPolicy
  ORIGINALFLIGHT: Originalflight
  NEARBY: Nearby
  VIASAT: Viasat
  pendingGovtApproval: PendingGovtApproval
}

export interface Lowest {
  badgeText: BadgeText2
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
}

export interface BadgeText2 {
  hasMarkup: boolean
  text: string
}

export interface Newairport {
  badgeText: BadgeText3
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  badgeURL: string
  id: string
}

export interface BadgeText3 {
  hasMarkup: boolean
  text: string
}

export interface InPolicy {
  badgeText: BadgeText4
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
  mobileBadgeIcon: MobileBadgeIcon2
  badgeIcon: string
}

export interface BadgeText4 {
  hasMarkup: boolean
  text: string
}

export interface MobileBadgeIcon2 {
  type: string
  url: string
}

export interface Vtlflt {
  badgeText: BadgeText5
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
}

export interface BadgeText5 {
  hasMarkup: boolean
  text: string
}

export interface CurrentFlight {
  badgeText: BadgeText6
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  travelStartDate: string
  travelEndDate: string
  searchStartDate: string
  searchEndDate: string
  id: string
}

export interface BadgeText6 {
  hasMarkup: boolean
  text: string
}

export interface NotAllowed {
  badgeText: BadgeText7
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
  mobileBadgeIcon: MobileBadgeIcon3
  badgeIcon: string
}

export interface BadgeText7 {
  hasMarkup: boolean
  text: string
}

export interface MobileBadgeIcon3 {
  type: string
  url: string
}

export interface Trnsvc {
  badgeText: BadgeText8
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  badgeURL: string
  id: string
}

export interface BadgeText8 {
  hasMarkup: boolean
  text: string
}

export interface Fastest {
  badgeText: BadgeText9
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
}

export interface BadgeText9 {
  hasMarkup: boolean
  text: string
}

export interface OutPolicy {
  badgeText: BadgeText10
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
  mobileBadgeIcon: MobileBadgeIcon4
  badgeIcon: string
}

export interface BadgeText10 {
  hasMarkup: boolean
  text: string
}

export interface MobileBadgeIcon4 {
  type: string
  url: string
}

export interface Originalflight {
  badgeText: BadgeText11
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  travelStartDate: string
  travelEndDate: string
  searchStartDate: string
  searchEndDate: string
  id: string
}

export interface BadgeText11 {
  hasMarkup: boolean
  text: string
}

export interface Nearby {
  badgeText: BadgeText12
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
}

export interface BadgeText12 {
  hasMarkup: boolean
  text: string
}

export interface Viasat {
  badgeText: BadgeText13
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  travelStartDate: string
  travelEndDate: string
  searchStartDate: string
  searchEndDate: string
  id: string
}

export interface BadgeText13 {
  hasMarkup: boolean
  text: string
}

export interface PendingGovtApproval {
  badgeText: BadgeText14
  badgeIndicator: string
  badgeBgColor: string
  badgePriorityIndicator: string
  id: string
}

export interface BadgeText14 {
  hasMarkup: boolean
  text: string
}

export interface AvailableBrandId {
  brandId: string
  brandName: string
  refundable: boolean
  groupId: string
  deltaProduct: boolean
  productOfCarrier: string
  brandBckColor: string
  brandGradientColorStart: string
  brandGradientColorEnd: string
  genericSeatExperience: GenericSeatExperience
  isBasicEconomy: string
  priority: string
  brandGradientAngle: string
  displayBrandGradient: string
  showProductModal: string
  hideBrand: boolean
  defaultBrand: boolean
  brandGroupName?: string
  overlayIconUrl?: string
}

export interface GenericSeatExperience {
  bulletPromos: BulletPromos
  disclaimer?: Disclaimer
  header: Header
  description: Description
  icons?: Icon[]
}

export interface BulletPromos {
  bullets: Bullet[]
  type: string
}

export interface Bullet {
  iconId: string
  displayDefault: string
  hasMarkup: boolean
  text: string
}

export interface Disclaimer {
  hasMarkup: boolean
  text: string
}

export interface Header {
  hasMarkup: boolean
  text: string
}

export interface Description {
  hasMarkup: boolean
  text: string
}

export interface Icon {
  iconId: string
  id: string
  mobileIconId: string
  displayDefault: string
}

export interface Page {
  resultCount: number
  num: number
  resultTotalCount: number
  highestResultCount: number
  lowestResultCount: number
}

export interface Itinerary {
  id: number
  fastest: boolean
  lowestFare: boolean
  seatReferenceId: string
  fare: Fare[]
  trip: Trip[]
  links: Link[]
  itineraryProduct: ItineraryProduct[]
  combinedBadgeSet: string[]
}

export interface Fare {
  miscFlightInfos: MiscFlightInfo[]
  fareId: number
  fareRulesCode: string[]
  ticketDesignator: string[]
  specialFareRulesCode: any[]
  segmentNbrFareRulesCode: any[]
  tax: any[]
  pointOfSaleCity: PointOfSaleCity
  baggageAllowance: BaggageAllowance
  fareRulesByFareBreak: any[]
  fareRestrictionByFlightSeg: any[]
  groupId: string
  currencySymbol: string
  seatSelectable: boolean
  showUpgradeEligible: boolean
  offered: boolean
  soldOut: boolean
  availableAtPostPurchase: boolean
  dominantSegmentBrandId: string
  solutionId: string
  brandByFlightLeg: BrandByFlightLeg[]
  fareRuleUrl: FareRuleUrl
  selectUrl: SelectUrl
  globalUpgradeCertificateStatus: boolean
  regionalUpgradeCertificateStatus: boolean
  offerId: string
  offerItemId: string
  upsellMetaData: UpsellMetaData
  fareBadges: any[]
  notAllowedByPolicy: boolean
  mixedBrandedProductExperience?: boolean
  cancelable?: boolean
  refundable?: boolean
  lowestFare?: boolean
  discountAvailable?: boolean
  webPriceAvailable?: boolean
  changeable?: boolean
  seatsAvailableCount?: number
  totalTaxAndFees?: TotalTaxAndFees
  basePrice?: BasePrice
  salesPrice?: SalesPrice
  totalPrice?: TotalPrice
  totalPriceByPTC?: TotalPriceByPtc
  fareCalcLine?: string
  paxInfo?: PaxInfo
  endorsement?: Endorsement[]
  totalPaxPrice?: TotalPaxPrice[]
  upgradeAvailable?: boolean
  multipleCos?: boolean
  multipleProducts?: boolean
  multipleCabins?: boolean
  payWithMilesEligible?: boolean
  upsell?: boolean
  selected?: boolean
  mixAndMatch?: boolean
  priority?: string
  unavailableForSale?: boolean
  fareProduct?: FareProduct[]
}

export interface MiscFlightInfo {
  airlineFltInfo: AirlineFltInfo
  cabinNameInfo: CabinNameInfo[]
  upgradeDetailByLegs: UpgradeDetailByLeg[]
  upgradeInfoByLegs: any[]
  bookingCode?: string
  derivedCabinCode?: string
  displayBookingCode?: string
}

export interface AirlineFltInfo {
  airline: Airline
  flightNbr: string
}

export interface Airline {
  airlineCode: string
  airlineName: string
}

export interface CabinNameInfo {
  destination: string
  id: string
  origin: string
}

export interface UpgradeDetailByLeg {
  upgradeDetails: any[]
}

export interface PointOfSaleCity {
  code?: string
}

export interface BaggageAllowance {}

export interface BrandByFlightLeg {
  flightSegmentId: number
  flightLegId: number
  brandId: string
  brandName: string
  tripId: number
  cos: string
  deltaProduct: boolean
  dominantLeg: boolean
  upgradeOption: any[]
  product: Product
  isBasicEconomy: string
  displayFareDetailsPopup: string
  showProductModal: string
  brandBckColor: string
  brandGradientColorStart: string
  brandGradientColorEnd: string
  priority: string
  brandGradientAngle: string
  displayPEUpsellModal: string
  displayBrandGradient: string
  brandGroupName?: string
}

export interface Product {
  priceableIn: any[]
  product: Product2[]
}

export interface Product2 {
  id: string
  typeCode: string
  iataServiceCode: string
  shortDesc: string
  priority: number
  productIconId: string
  tagLine: string
  priceableIn: any[]
  product: any[]
  disclaimer: string
  imageURL: string
  rankOrder?: string[]
}

export interface FareRuleUrl {
  href: string
  payload: string
}

export interface SelectUrl {
  href: string
  payload: string
}

export interface UpsellMetaData {
  fareBrand: string
  hideBrand: boolean
  eligibleUpsellBrands?: string[]
}

export interface TotalTaxAndFees {
  currency: Currency
}

export interface Currency {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface BasePrice {
  currency: Currency2
  miles: Miles
}

export interface Currency2 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles {
  miles: number
}

export interface SalesPrice {
  currency: Currency3
  miles: Miles2
}

export interface Currency3 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles2 {
  miles: number
}

export interface TotalPrice {
  currency: Currency4
  miles: Miles3
}

export interface Currency4 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles3 {
  miles: number
}

export interface TotalPriceByPtc {
  currency: Currency5
  miles: Miles4
}

export interface Currency5 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles4 {
  miles: number
}

export interface PaxInfo {
  type: string
  count: number
}

export interface Endorsement {
  carrier: Carrier
  extendedFareCode: string
  text: string
  originAirportCode: string
  destAirportCode: string
}

export interface Carrier {
  code: string
}

export interface TotalPaxPrice {
  currency: Currency6
  miles: Miles5
}

export interface Currency6 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles5 {
  miles: number
}

export interface FareProduct {
  product: Product3[]
}

export interface Product3 {
  id: string
  priceableIn: any[]
  product: any[]
  typeCode?: string
  category?: string
  longDesc?: string
}

export interface Trip {
  id: number
  schedDepartLocalTs: string
  tripDepartureDateOutbound: string
  tripDepartureTime: string
  tripArrivalDate: string
  tripArrivalTime: string
  schedArrivalLocalTs: string
  originAirportCode: string
  originCity: string
  destAirportCode: string
  destCity: string
  stopCount: number
  nearByAirport: boolean
  differentDepartureAirport: boolean
  newAirport: boolean
  flightSegment: FlightSegment[]
  totalTripTime: TotalTripTime
  summarizedProducts: SummarizedProduct[]
  viewSeatUrls: ViewSeatUrl2[]
  newSubFleetType: boolean
  dominantFlightLeg: DominantFlightLeg
  originCnCd: string
  destinationCnCd: string
  tripProduct: TripProduct[]
}

export interface FlightSegment {
  id: number
  dayChange: boolean
  pendingGovtApproval: boolean
  pendingGovtApprovalTxt: string
  dominantSegment: boolean
  newAirport: boolean
  stopCount: number
  originAirportCode: string
  originCity: string
  destAirportCode: string
  destCity: string
  schedDepartLocalTs: string
  schedArrivalLocalTs: string
  operatingFlightNum: string
  marketingFlightNum: string
  marketingCos: string
  totalAirTime: TotalAirTime
  aircraft: Aircraft
  marketingCarrier: MarketingCarrier
  ticketingTimeLimitUtcTs: string
  flightLeg: FlightLeg[]
  trainSegment: boolean
  layover?: Layover
}

export interface TotalAirTime {
  hour: number
  minute: number
  day: number
}

export interface Aircraft {
  fleetTypeCode: string
  subFleetTypeCode: string
  newSubFleetType: boolean
}

export interface MarketingCarrier {
  code: string
  name: string
}

export interface FlightLeg {
  id: number
  tripFlightLegId: number
  redEye: boolean
  dayChange: boolean
  dominantLeg: boolean
  newAirport: boolean
  originAirportCode: string
  originCity: string
  destAirportCode: string
  destCity: string
  schedDepartLocalTs: string
  schedArrivalLocalTs: string
  duration: Duration
  marketingCarrier: MarketingCarrier2
  operatingCarrier: OperatingCarrier
  distance: Distance
  aircraft: Aircraft2
  feeRestricted: boolean
  operatedByOwnerAirline: boolean
  viewSeatUrl: ViewSeatUrl
  flightLegProduct: FlightLegProduct[]
  originTerminal?: OriginTerminal
  destinationTerminal?: DestinationTerminal
  trainLeg: boolean
  onTimePerformance?: OnTimePerformance
}

export interface Duration {
  hour: number
  minute: number
  day: number
}

export interface MarketingCarrier2 {
  code: string
  connectionCarrier: boolean
  name: string
}

export interface OperatingCarrier {
  code: string
  connectionCarrier: boolean
  name: string
}

export interface Distance {
  unit: string
  measure: number
}

export interface Aircraft2 {
  fleetTypeCode: string
  fleetName: string
  subFleetTypeCode: string
  newSubFleetType: boolean
}

export interface ViewSeatUrl {
  fltNumber: string
  originCityCode: string
  fltIndex: string
  triggerSourceId: string
  currencyCode: string
  hasBusFirst: boolean
  viewSeatActionURL: string
  seatsURLParameters: SeatsUrlparameter[]
  numberOfPassengers: string
  fareOffer: FareOffer
}

export interface SeatsUrlparameter {
  airlineCode: string
  operatingAirline: string
  flightNumber: string
  marketingAirlineCode: string
  operatingAirlineCode: string
  marketingFlightNumber: string
  departureCity: string
  departureDate: string
  departureTime: string
  localDepartureDate: string
  localDepartureTime: string
  arrivalCity: string
  arrivalDate: string
  arrivalTime: string
  classOfService: string
  localArrivalDate: string
  localArrivalTime: string
  marketingClassOfServiceCode: string
  tripId: string
  flightInfoIndex: string
  segmentNumber: string
  legId: string
  fleetName: string
  subFleetTypeCode: string
  fleetTypeCode: string
  seatReferenceId: string
}

export interface FareOffer {
  itineraryOfferList: ItineraryOfferList[]
  priceType: string
}

export interface ItineraryOfferList {
  totalPrice?: TotalPrice2
  basePrice?: BasePrice2
  totalTaxFees?: TotalTaxFees
  soldOut: boolean
  offered: boolean
  dominantSegmentBrandId: string
  solutionId: string
  brandInfoByFlightLegs: BrandInfoByFlightLeg[]
  fareRulesCode: string[]
}

export interface TotalPrice2 {
  currency?: Currency7
  miles?: Miles6
}

export interface Currency7 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles6 {
  miles: number
}

export interface BasePrice2 {
  currency?: Currency8
  miles?: Miles7
}

export interface Currency8 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles7 {
  miles: number
}

export interface TotalTaxFees {
  currency?: Currency9
}

export interface Currency9 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface BrandInfoByFlightLeg {
  flightSegmentId: number
  flightLegId: number
  brandId: string
  tripId: number
  cos: string
}

export interface FlightLegProduct {
  product: any[]
}

export interface OriginTerminal {
  terminalId: string
  terminalName: string
}

export interface DestinationTerminal {
  terminalId: string
  terminalName: string
}

export interface OnTimePerformance {
  unit: string
  measure: number
}

export interface Layover {
  equipmentChange: boolean
  changeOfAirport: boolean
  layoverAirportCode: string
  layoverCityName: string
  layoverCityRegion: string
  departFlightNum: string
  arrivalFlightNum: string
  departMarketingCarrier: DepartMarketingCarrier
  departOperatingCarrier: DepartOperatingCarrier
  arrivalMarketingCarrier: ArrivalMarketingCarrier
  arrivalOperatingCarrier: ArrivalOperatingCarrier
  duration: Duration2
  originAirportCode: string
  destAirportCode: string
  schedDepartLocalTs: string
  schedArrivalLocalTs: string
  trainConnection: boolean
}

export interface DepartMarketingCarrier {
  code: string
}

export interface DepartOperatingCarrier {
  code: string
}

export interface ArrivalMarketingCarrier {
  code: string
}

export interface ArrivalOperatingCarrier {
  code: string
}

export interface Duration2 {
  hour: number
  minute: number
}

export interface TotalTripTime {
  hour: number
  minute: number
  day: number
}

export interface SummarizedProduct {
  id: string
  shortDesc: string
  productIconId: string
  tagLine: string
  disclaimer: string
  imageURL: string
  rankOrder?: string[]
}

export interface ViewSeatUrl2 {
  fltIndex: string
  triggerSourceId: string
  currencyCode: string
  hasBusFirst: boolean
  viewSeatActionURL: string
  seatsURLParameters: SeatsUrlparameter2[]
  numberOfPassengers: string
  fareOffer: FareOffer2
}

export interface SeatsUrlparameter2 {
  airlineCode: string
  operatingAirline: string
  flightNumber: string
  marketingAirlineCode: string
  operatingAirlineCode: string
  marketingFlightNumber: string
  departureCity: string
  departureDate: string
  departureTime: string
  localDepartureDate: string
  localDepartureTime: string
  arrivalCity: string
  arrivalDate: string
  arrivalTime: string
  classOfService: string
  localArrivalDate: string
  localArrivalTime: string
  marketingClassOfServiceCode: string
  tripId: string
  flightInfoIndex: string
  segmentNumber: string
  legId: string
  fleetName: string
  subFleetTypeCode: string
  fleetTypeCode: string
  seatReferenceId: string
}

export interface FareOffer2 {
  itineraryOfferList: ItineraryOfferList2[]
  priceType: string
}

export interface ItineraryOfferList2 {
  totalPrice?: TotalPrice3
  basePrice?: BasePrice3
  totalTaxFees?: TotalTaxFees2
  soldOut: boolean
  offered: boolean
  dominantSegmentBrandId: string
  solutionId: string
  brandInfoByFlightLegs: BrandInfoByFlightLeg2[]
  fareRulesCode: string[]
}

export interface TotalPrice3 {
  currency?: Currency10
  miles?: Miles8
}

export interface Currency10 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles8 {
  miles: number
}

export interface BasePrice3 {
  currency?: Currency11
  miles?: Miles9
}

export interface Currency11 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface Miles9 {
  miles: number
}

export interface TotalTaxFees2 {
  currency?: Currency12
}

export interface Currency12 {
  code: string
  currencySymbol: string
  amount: number
  decimalPrecision: number
  roundedAmount: number
  formattedAmount: string
  numericPart: string
  fractionalPart: string
  formattedRoundedAmount: string
}

export interface BrandInfoByFlightLeg2 {
  flightSegmentId: number
  flightLegId: number
  brandId: string
  tripId: number
  cos: string
}

export interface DominantFlightLeg {
  dominantFlightIndex: number
  dominantLegIndex: number
  legCount: number
  dominantBrandLegIndex: number
}

export interface TripProduct {
  product: Product4[]
}

export interface Product4 {
  id: string
  typeCode: string
  category: string
  longDesc: string
  priceableIn: any[]
  product: any[]
}

export interface Link {
  rel: string
  href: string
  payload: Payload
}

export interface Payload {
  legList: LegList[]
  appID: string
  destinationCities: string[]
  pageID: string
  channelID: string
}

export interface LegList {
  destinationAirportCode: string
  originAirportCode: string
  classOfServiceSlugList: ClassOfServiceSlugList[]
  airlineCode: string
  schedLocalDepartDate: string
  flightNumber: string
}

export interface ClassOfServiceSlugList {
  "MAIN-award"?: string
  "D1-award"?: string
  "DCP-award"?: string
  "FIRST-award"?: string
}

export interface ItineraryProduct {
  product: any[]
}

export interface Filter {
  stopCount: number[]
  departAirportCode: any[]
  arrivalAirportCode: any[]
  layoverAirportCode: string[]
  layoverAirport: LayoverAirport[]
  flightDurationRange: FlightDurationRange
  connectionTimeRange: ConnectionTimeRange
  totalPriceRange: TotalPriceRange
  totalMilesRange: TotalMilesRange
  flightStop: FlightStop[]
}

export interface LayoverAirport {
  airportCode: string
  airportName: string
  cityName: string
  region: string
  nearByCities: any[]
}

export interface FlightDurationRange {
  min: number
  max: number
}

export interface ConnectionTimeRange {
  min: number
  max: number
}

export interface TotalPriceRange {
  min: number
  max: number
}

export interface TotalMilesRange {
  min: number
  max: number
}

export interface FlightStop {
  stopCount: number
  stop: string
  stopType: string
}

export interface SortOption {
  id: string
  desc: string
  link: Link2
}

export interface Link2 {
  rel: string
  href: string
  payload: Payload2
}

export interface Payload2 {
  filter: any
  bestFare: string
  action: string
  iframe: any
  destinationAirportRadius: DestinationAirportRadius2
  flightType: any
  deltaOnlySearch: boolean
  meetingEventCode: string
  originAirportRadius: OriginAirportRadius2
  passengers: Passenger2[]
  searchType: string
  segments: Segment2[]
  shopType: string
  tripType: string
  priceType: string
  priceSchedule: string
  awardTravel: boolean
  cabinFareClass: any
  refundableFlightsOnly: boolean
  nonstopFlightsOnly: boolean
  datesFlexible: boolean
  flexOption: any
  flexDays: any
  flexMonth: any
  flexCalendar: boolean
  flexAirport: boolean
  upgradeRequest: boolean
  showUpgrade: any
  smTravelling: any
  toContinue: any
  corporateSMTravelType: string
  selectedCorporateAgreementId: any
  branchingOptions: any
  corpMbr: any
  removeEdoc: any
  defaultTimeOption: any
  numberOfColumnsRequested: any
  pageName: string
  cashMilesToggle: any
  outboundAPDays: any
  inboundAPDays: any
  reviseToFlexWarningMessage: any
  fareFamiliesKey: any
  fareClassesKey: any
  fareFamiliesValue: any
  clarifyTotalPrice: any
  docNumber: any
  redemptionCode: any
  fareFamiliesMoneyValue: any
  fareFamiliesMoneyKey: any
  fareFamiliesMilesValue: any
  fareFamiliesMilesKey: any
  cacheKey: string
  checksum: any
  requestPageNum: string
  resultsPerRequestNum: any
  sortableOptionId: string
  sortableOptionBrandId?: string
  discountCertificate: any
  customer: any
  currentSolution: any
  selectedSolutions: any[]
  selectedCorporateAgreement: any
  actionType: string
  initialSearchBy: InitialSearchBy2
  vendorDetails: any
  brandPriority: any
}

export interface DestinationAirportRadius2 {
  unit: string
  measure: number
}

export interface OriginAirportRadius2 {
  unit: string
  measure: number
}

export interface Passenger2 {
  type: string
  age: any
  birthDate: any
  count: number
}

export interface Segment2 {
  returnDateTs: any
  departureDateTs: any
  returnDate: any
  connectionAirportCode: any
  departureDate: string
  destination: string
  origin: string
  tripId: any
  tripAdded: any
}

export interface InitialSearchBy2 {
  fareFamily: string
  cabinFareClass: any
  meetingEventCode: string
  refundable: boolean
  flexAirport: boolean
  flexDate: boolean
  flexDaysWeeks: string
  deepLinkVendorId: any
  upsellFareSelected: any
  upsellFareRejected: any
  refundableFareSelected: any
}

export interface Link3 {
  rel: string
  href: string
  payload: Payload3
}

export interface Payload3 {
  compareInputObjJson: string
}

export interface ShopTypeOption2 {
  rel: string
  href: string
  payload: Payload4
}

export interface Payload4 {
  filter: any
  bestFare: string
  action: string
  iframe: any
  destinationAirportRadius: DestinationAirportRadius3
  flightType: any
  deltaOnlySearch: boolean
  meetingEventCode: string
  originAirportRadius: OriginAirportRadius3
  passengers: Passenger3[]
  searchType: string
  segments: Segment3[]
  shopType: string
  tripType: string
  priceType: string
  priceSchedule: string
  awardTravel: boolean
  cabinFareClass: any
  refundableFlightsOnly: boolean
  nonstopFlightsOnly: boolean
  datesFlexible: boolean
  flexOption: any
  flexDays: any
  flexMonth: any
  flexCalendar: boolean
  flexAirport: boolean
  upgradeRequest: boolean
  showUpgrade: any
  smTravelling: any
  toContinue: any
  corporateSMTravelType: string
  selectedCorporateAgreementId: any
  branchingOptions: any
  corpMbr: any
  removeEdoc: any
  defaultTimeOption: any
  numberOfColumnsRequested: any
  pageName: string
  cashMilesToggle: any
  outboundAPDays: any
  inboundAPDays: any
  reviseToFlexWarningMessage: any
  fareFamiliesKey: any
  fareClassesKey: any
  fareFamiliesValue: any
  clarifyTotalPrice: any
  docNumber: any
  redemptionCode: any
  fareFamiliesMoneyValue: any
  fareFamiliesMoneyKey: any
  fareFamiliesMilesValue: any
  fareFamiliesMilesKey: any
  cacheKey: string
  checksum: any
  requestPageNum: string
  resultsPerRequestNum: any
  sortableOptionId: string
  sortableOptionBrandId: any
  discountCertificate: any
  customer: any
  currentSolution: any
  selectedSolutions: any[]
  selectedCorporateAgreement: any
  actionType: string
  initialSearchBy: InitialSearchBy3
  vendorDetails: any
  brandPriority: any
}

export interface DestinationAirportRadius3 {
  unit: string
  measure: number
}

export interface OriginAirportRadius3 {
  unit: string
  measure: number
}

export interface Passenger3 {
  type: string
  age: any
  birthDate: any
  count: number
}

export interface Segment3 {
  returnDateTs: any
  departureDateTs: any
  returnDate: any
  connectionAirportCode: any
  departureDate: string
  destination: string
  origin: string
  tripId: any
  tripAdded: any
}

export interface InitialSearchBy3 {
  fareFamily: string
  cabinFareClass: any
  meetingEventCode: string
  refundable: boolean
  flexAirport: boolean
  flexDate: boolean
  flexDaysWeeks: string
  deepLinkVendorId: any
  upsellFareSelected: any
  upsellFareRejected: any
  refundableFareSelected: any
}

export interface DynamicBannerRequest {
  userdata: Userdata
  requestparam: Requestparam
}

export interface Userdata {
  triptype: string
  includesaturdaynightstay: boolean
  flightResultBadgeSet: string[]
  membershipLevel: string
  flightName: string[]
  origin: string
  shoppingDate: string
  destination: string
  departuredate: string
  noofpassengers: number
  layoverAirports: LayoverAirports
  markettype: string
  outOfPolicy: string
  originDestinationPair: string
  departureadvancepurchase: number
  subFlightCode: string[]
  originCnCd: string
  availableFareBrands: string[]
  loggedinrestriction: string
  flightNumber: string[]
  skymilesTier: string
  marketingFlightNumber: string[]
  destinationCnCd: string
  corporate: boolean
  noOfStops: number[]
  loggedIn: string
  shopType: string
  layover: string[]
}

export type LayoverAirports = Record<string, string>

export interface Requestparam {
  campaignId: string
}

export interface NearbyAirports {
  hasNearby: boolean
  nearByDestinationAirportCodes: any[]
  nearByOriginAirportCodes: any[]
}

export interface MetaData {
  offerRequestId: string
  offerResponseId: string
  solutionSetID: string
}
