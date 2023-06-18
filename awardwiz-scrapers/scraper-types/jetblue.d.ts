export type JetBlueResponse = {
  error?: {
    httpStatus: string
    code: string
    message: string
    guid: string
    ic: string
  }
  dategroup?: {
    to: string
    from: string
    group: {
      uri: string
      date: string
      points: string
      fareTax: string
    }[]
  }[]
  itinerary?: {
    id: string
    sequenceID: string
    from: string
    to: string
    depart: string
    arrive: string
    isOverNightFlight: boolean
    isQuickest: boolean
    duration: string
    arrivalOffset: string
    bundles: {
      id: string
      code?: string
      refundable: string
      fareCode: string
      points?: string
      fareTax?: string
      cabinclass: string
      bookingclass?: string
      status: string
      inventoryQuantity?: string
      price?: string
    }[]
    segments: {
      id: string
      from: string
      to: string
      aircraft: string
      aircraftCode: string
      aircraftAmenityKey: string
      stops: number
      depart: string
      arrive: string
      flightno: string
      duration: string
      bookingclass: string
      cabinclass: string
      operatingAirlineCode: string
      marketingAirlineCode: string
      operatingAirlineName: string
      marketingAirlineName: string
      filingAirline: string
      marketingAirline: string
      seatMapUri: string
      distance: number
      throughFlightLegs: {
        departureAirport: string
        arrivalAirport: string
        departureTerminal?: string
        arrivalTerminal: string
        duration: string
      }[]
      layover?: string
    }[]
    connections?: string[]
  }[]
  stopsFilter: number[]
  countryCode: string
  currency: string
  programName: string
  isTransatlanticRoute: boolean
}
