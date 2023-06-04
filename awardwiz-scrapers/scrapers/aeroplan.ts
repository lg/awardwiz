import { AwardWizScraper, FlightFare, FlightWithFares } from "../awardwiz-types.js"
import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { AeroplanResponse } from "../scraper-types/aeroplan.js"

export const meta: ScraperMetadata = {
  name: "aeroplan",
  blockUrls: ["go-mpulse.net", "adobedtm.com"] // , "techlab-cdn.com"]
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  const paramsText = `org0=${query.origin}&dest0=${query.destination}&departureDate0=${query.departureDate}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=TNB`
  arkalis.goto(`https://www.aircanada.com/aeroplan/redeem/availability/outbound?${paramsText}`)
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "*/loyalty/dapidynamic/*/v2/search/air-bounds" },
    "anti-botting1": { type: "url", url: "*/aeroplan/redeem/" },
    "anti-botting2": { type: "url", url: "*/loyalty/dapidynamic/*/v2/reward/market-token", onlyStatusCode: 403 },
    "anti-botting3": { type: "html", html: "Air Canada's website is not available right now." }
  })
  if (waitForResult.name !== "success")
    throw new Error(waitForResult.name)
  const fetchFlights = JSON.parse(waitForResult.response!.body) as AeroplanResponse
  if (fetchFlights.errors?.length)
    return arkalis.warn(`request returned error (${fetchFlights.errors.map((error) => error.title).join(", ")})`)

  arkalis.log("parsing results")
  const flightsWithFares: FlightWithFares[] = []
  if (fetchFlights.data?.airBoundGroups && fetchFlights.data.airBoundGroups.length > 0) {
    const flights = standardizeResults(fetchFlights, query.origin, query.destination)
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (raw: AeroplanResponse, origOrigin: string, origDestination: string) => {
  const results: FlightWithFares[] = []
  for (const group of raw.data?.airBoundGroups ?? []) {
    const { flightId } = group.boundDetails.segments[0]!
    const flightLookup = raw.dictionaries.flight[flightId]!

    const result: FlightWithFares = {
      departureDateTime: flightLookup.departure.dateTime.slice(0, 19).replace("T", " "),
      arrivalDateTime: flightLookup.arrival.dateTime.slice(0, 19).replace("T", " "),
      origin: flightLookup.departure.locationCode,
      destination: flightLookup.arrival.locationCode,
      flightNo: `${flightLookup.marketingAirlineCode} ${flightLookup.marketingFlightNumber}`,
      duration: flightLookup.duration / 60,
      aircraft: raw.dictionaries.aircraft[flightLookup.aircraftCode],
      fares: [],
      amenities: {
        hasPods: undefined,
        hasWiFi: undefined  // populated via json from https://www.aircanada.com/aeroplan/redeem/main-es2015.09be3572766daf3ffaa9.js from the aircraftWithWifi variable
      },
    }

    // Skip flights with connections
    if (group.boundDetails.segments.length > 1)
      continue

    if (flightLookup.departure.locationCode !== origOrigin || flightLookup.arrival.locationCode !== origDestination)
      continue

    const aircraft = raw.dictionaries.aircraft[flightLookup.aircraftCode]
    if (!aircraft)
      throw new Error(`Unknown aircraft type: ${flightLookup.aircraftCode}`)

    for (const fare of group.airBounds) {
      const cabinShortToCabin: Record<string, string> = { eco: "economy", ecoPremium: "economy", business: "business", first: "first" }
      let cabin = cabinShortToCabin[fare.availabilityDetails[0]!.cabin]
      if (!cabin)
        throw new Error(`Unknown cabin type: ${fare.availabilityDetails[0]!.cabin}`)

      const { bookingClass } = fare.availabilityDetails[0]!

      // Override for United marketing its Business class as First
      if (bookingClass === "I" && flightLookup.marketingAirlineCode === "UA")
        cabin = "economy"

      const fareToAdd: FlightFare = {
        cabin,
        bookingClass,
        miles: fare.prices.milesConversion.convertedMiles.base,
        currencyOfCash: fare.prices.milesConversion.remainingNonConverted.currencyCode,
        cash: Math.ceil(fare.prices.milesConversion.convertedMiles.totalTaxes / 100),
        scraper: "aeroplan"
      }

      // Only keep the lowest fare for each cabin
      const existingForCabin = result.fares.find((f) => f.cabin === fareToAdd.cabin)
      if (existingForCabin) {
        if (fareToAdd.miles < existingForCabin.miles) {
          result.fares = result.fares.filter((f) => f !== existingForCabin)
          result.fares.push(fareToAdd)
        }
      } else {
        result.fares.push(fareToAdd)
      }
    }

    results.push(result)
  }

  return results
}