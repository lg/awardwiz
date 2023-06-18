export type AlaskaResponse = {
  departureStation: string
  arrivalStation: string
  slices?: {
    id: number
    origin: string
    destination: string
    duration: number
    matrixOperationalDisclosures: {
      carrier: string
      disclosures: string[]
    }[]
    segments: {
      publishingCarrier: {
        carrierCode: string
        carrierFullName: string
        flightNumber: number
      }
      displayCarrier: {
        carrierCode: string
        carrierFullName: string
        flightNumber: number
      }
      departureStation: string
      arrivalStation: string
      aircraftCode: string
      aircraft: string
      duration: number
      departureTime: string
      arrivalTime: string
      nextDayArrival: boolean
      nextDayDeparture: boolean
      performance: {
        canceledPercentage: number
        aircraftCode: string
        aircraft: string
        percentLate30Plus: number
        percentOntime: number
        departureAirportCode: string
        arrivalAirportCode: string
        changeOfPlane: boolean
        destination: {
          airport: string
          dateTime: string
        }
        origin: {
          airport: string
          dateTime: string
        }
        distance: {
          unit: string
          length: number
        }
        durationMinutes: number
      }[]
      stopoverInformation: string
      stopoverDuration: number
      operationalDisclosure: string
      subjectToGovernmentApproval: boolean
      detailsDisplayOperationalDisclosure: string
      firstClassUpgradeAvailable: boolean
      firstClassUpgradeUnavailable: boolean
      amenities: string[]
      firstAmenities: string[]
    }[]
    upgradeInfo: any[]
    fares: Record<string, {
      grandTotal: number
      milesPoints: number
      seatsRemaining: number
      discount: boolean
      mixedCabin: boolean
      cabins: string[]
      bookingCodes: string[]
      refundable: boolean
      qpxcSolutionID: string
    }>
  }[]
  env: string
  qpxcSessionID: string
  qpxcSolutionSetID: string
  advisories: any[]
}
