export interface SkyScannerResponse {
  query: Query
  context: Context
  itineraries: Itinerary[]
  legs: Leg2[]
  segments: Segment[]
  places: Place[]
  carriers: Carrier[]
  alliances: Alliance[]
  brands: any[]
  agents: Agent[]
  stats: Stats
  quote_requests: any[]
  quotes: any[]
  repro_urls: ReproUrls
  rejected_itineraries: any[]
  plugins: Plugin[]
}

export interface Query {
  market: string
  currency: string
  locale: string
  adults: number
  child_ages: any[]
  cabin_class: string
  legs: Leg[]
  children: number
  infants: number
}

export interface Leg {
  origin: number
  alternative_origins: any[]
  destination: number
  alternative_destinations: any[]
  date: string
}

export interface Context {
  request_id: string
  session_id: string
}

export interface Itinerary {
  id: string
  leg_ids: string[]
  pricing_options: PricingOption[]
  score: number
}

export interface PricingOption {
  agent_ids: string[]
  price: Price
  unpriced_type: string
  items: Item[]
  transfer_type: string
  score: number
  filter_pill_labels: any[]
}

export interface Price {
  amount: number
  update_status: string
  last_updated: string
  quote_age: number
}

export interface Item {
  agent_id: string
  url: string
  segment_ids: string[]
  price: Price2
  booking_proposition: string
  transfer_protection: string
  max_redirect_age: number
  fares: Fare[]
  opaque_id: string
  booking_metadata: BookingMetadata
  ticket_attributes: any[]
  flight_attributes: any[]
}

export interface Price2 {
  amount: number
  update_status: string
  last_updated: string
  quote_age: number
}

export interface Fare {
  segment_id: string
  fare_basis_code: string
  booking_code: string
  fare_family?: string
  fare_attributes: FareAttributes
}

export interface FareAttributes {
  is_seat_selection_included: boolean
}

export interface BookingMetadata {
  metadata_set: string
  signature: string
}

export interface Leg2 {
  id: string
  origin_place_id: number
  destination_place_id: number
  departure: string
  arrival: string
  segment_ids: string[]
  duration: number
  stop_count: number
  marketing_carrier_ids: number[]
  operating_carrier_ids: number[]
  stop_ids: number[][]
}

export interface Segment {
  id: string
  origin_place_id: number
  destination_place_id: number
  arrival: string
  departure: string
  duration: number
  marketing_flight_number: string
  marketing_carrier_id: number
  operating_carrier_id: number
  mode: string
}

export interface Place {
  id: number
  entity_id: number
  alt_id: string
  parent_id: number
  parent_entity_id?: number
  name: string
  type: string
  display_code: string
}

export interface Carrier {
  id: number
  name: string
  alt_id: string
  display_code: string
  display_code_type: string
  alliance?: number
}

export interface Alliance {
  id: number
  name: string
}

export interface Agent {
  id: string
  name: string
  is_carrier: boolean
  update_status: string
  optimised_for_mobile: boolean
  live_update_allowed: boolean
  rating_status: string
  rating: number
  feedback_count: number
  rating_breakdown: RatingBreakdown
}

export interface RatingBreakdown {
  reliable_prices: number
  clear_extra_fees: number
  customer_service: number
  ease_of_booking: number
  other: number
}

export interface Stats {
  itineraries: Itineraries
  legs: Leg3[]
  carriers: Carriers
  filter_hints: FilterHints
}

export interface Itineraries {
  min_duration: number
  max_duration: number
  min_longest_itinerary_leg_duration: number
  max_longest_itinerary_leg_duration: number
  total: Total
  stops: Stops
  fares: Fares
}

export interface Total {
  count: number
  min_price: number
}

export interface Stops {
  direct: Direct
  one_stop: OneStop
  two_plus_stops: TwoPlusStops
}

export interface Direct {
  total: Total2
  ticket: Ticket
}

export interface Total2 {
  count: number
  min_price: number
}

export interface Ticket {
  single_ticket: SingleTicket
  multi_ticket_non_npt: MultiTicketNonNpt
  multi_ticket_npt: MultiTicketNpt
}

export interface SingleTicket {
  count: number
  min_price: number
}

export interface MultiTicketNonNpt {
  count: number
}

export interface MultiTicketNpt {
  count: number
}

export interface OneStop {
  total: Total3
  ticket: Ticket2
}

export interface Total3 {
  count: number
  min_price: number
}

export interface Ticket2 {
  single_ticket: SingleTicket2
  multi_ticket_non_npt: MultiTicketNonNpt2
  multi_ticket_npt: MultiTicketNpt2
}

export interface SingleTicket2 {
  count: number
  min_price: number
}

export interface MultiTicketNonNpt2 {
  count: number
}

export interface MultiTicketNpt2 {
  count: number
}

export interface TwoPlusStops {
  total: Total4
  ticket: Ticket3
}

export interface Total4 {
  count: number
}

export interface Ticket3 {
  single_ticket: SingleTicket3
  multi_ticket_non_npt: MultiTicketNonNpt3
  multi_ticket_npt: MultiTicketNpt3
}

export interface SingleTicket3 {
  count: number
}

export interface MultiTicketNonNpt3 {
  count: number
}

export interface MultiTicketNpt3 {
  count: number
}

export interface Fares {
  advance_seat_selection: AdvanceSeatSelection
}

export interface AdvanceSeatSelection {
  count: number
}

export interface Leg3 {
  index: number
  min_duration: number
  max_duration: number
  count: number
  origins: Origin[]
  destinations: Destination[]
}

export interface Origin {
  id: number
  count: number
}

export interface Destination {
  id: number
  count: number
}

export interface Carriers {
  single_carriers: SingleCarrier[]
  multiple_carriers: MultipleCarriers
}

export interface SingleCarrier {
  id: number
  count: number
  min_price: number
}

export interface MultipleCarriers {
  count: number
}

export interface FilterHints {
  enable_direct_filter: boolean
  enable_one_stop_filter: boolean
  enable_two_plus_stops_filter: boolean
  enable_advance_seat_selection_filter: boolean
}

export interface ReproUrls {
  ps_repro_url: string
  lus_repro_urls: any[]
}

export interface Plugin {
  "@type": string
  creatives?: Crea[]
  status?: string
  matches?: Match[]
  position_to_impression_id?: PositionToImpressionId
  creative_position_to_impression_id?: CreativePositionToImpressionId
  itineraries?: Itineraries2
}

export interface Crea {
  id_format: string
  fields: Fields
  analytics_properties: AnalyticsProperties
  pixels: Pixels
}

export interface Fields {
  appIndex: string
  experiments: string
  layoutType?: string
  message: string
  partnerDesktopLogo?: string
  partnerLogo: string
  redirectUrl: string
  search?: string
  sponsoredText: string
  strevdaId: string
  title?: string
  callToActionText?: string
  headline?: string
  image?: string
}

export interface AnalyticsProperties {
  appIndex: string
  id_campaign: string
  id_creative: string
  id_placement: string
  id_request: string
  id_tracking: string
  priority: string
  service: string
}

export interface Pixels {
  impression: string[]
  click: string[]
  view: string[]
  price: any[]
  refresh_update: string[]
  engage: string[]
  click_details: string[]
}

export interface Match {
  id_format: string
  fields: Fields2
  analytics_properties: AnalyticsProperties2
  pixels: Pixels2
}

export interface Fields2 {
  experiments: string
  layoutType?: string
  message: string
  partnerDesktopLogo?: string
  partnerLogo: string
  redirectUrl: string
  search?: string
  sponsoredText: string
  strevdaId: string
  title?: string
  callToActionText?: string
  headline?: string
  image?: string
}

export interface AnalyticsProperties2 {
  id_campaign: string
  id_creative: string
  id_placement: string
  priority: string
  service: string
}

export interface Pixels2 {
  impression: string[]
  click: string[]
  view: string[]
  price: any[]
  refresh_update: string[]
  engage: string[]
  click_details: string[]
}

export interface PositionToImpressionId {}

export type CreativePositionToImpressionId = Record<string, string>

export type Itineraries2 = Record<string, ItineraryEco>

export interface ItineraryEco {
  id: string
  is_eco_contender: boolean
  eco_contender_delta: number
}
