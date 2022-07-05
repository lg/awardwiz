import { HTTPResponse } from "puppeteer"
import { FlightWithFares, ScraperCapabilities, ScraperFunc, FlightFare } from "../types/scrapers"
import { JetBlueFetchFlights } from "./extra/jetblue-types"

export const capabilities: ScraperCapabilities = {
  missingAttributes: [],
  missingFareAttributes: ["isSaverFare"]
}

export const scraper: ScraperFunc = async ({ page, context }) => {
  page.goto(`https://www.jetblue.com/booking/flights?from=${context.origin}&to=${context.destination}&depart=${context.departureDate}&isMultiCity=false&noOfRoute=1&lang=en&adults=1&children=0&infants=0&sharedMarket=false&roundTripFaresFlag=false&usePoints=true`)
  const response = await page.waitForResponse((checkResponse: HTTPResponse) => {
    return checkResponse.url() === "https://jbrest.jetblue.com/lfs-rwb/outboundLFS" && checkResponse.request().method() === "POST"
  }, { timeout: 20000 })
  const raw = await response.json() as JetBlueFetchFlights

  const flightsWithFares: FlightWithFares[] = []
  if (raw.itinerary && raw.itinerary.length > 0) {
    const flights = standardizeResults(raw)
    flightsWithFares.push(...flights)
  }

  return { data: { flightsWithFares } }
}

// note: they have an entire lookup call that's made for this for all their partners (which seem to not be searchable on points)
const cabinClassToCabin: {[ cabinClass: string ]: string} = {
  Y: "economy",
  C: "business"    // mint class on jetblue
}

const standardizeResults = (raw: JetBlueFetchFlights) => {
  const results: FlightWithFares[] = []
  raw.itinerary.forEach((itinerary) => {
    const durationText = itinerary.segments[0].duration.match(/.+?(\d+?)H(\d+?)M/)
    if (!durationText)
      throw new Error("Invalid duration for flight")

    const result: FlightWithFares = {
      departureDateTime: itinerary.depart.substring(0, 19).replace("T", " "),
      arrivalDateTime: itinerary.arrive.substring(0, 19).replace("T", " "),
      origin: itinerary.from,
      destination: itinerary.to,
      flightNo: `${itinerary.segments[0].marketingAirlineCode} ${itinerary.segments[0].flightno}`,
      duration: parseInt(durationText?.[1], 10) * 60 + parseInt(durationText?.[2], 10),
      aircraft: itinerary.segments[0].aircraft,
      fares: [],
      amenities: {}
    }

    // Skip flights with connections
    if (itinerary.segments.length > 1)
      return

    const itineraryId = itinerary.id
    raw.fareGroup.forEach((checkFare) => {
      checkFare.bundleList.forEach((bundle) => {
        if (bundle.itineraryID !== itineraryId)
          return
        if (bundle.points === "N/A")
          return

        const cabin = cabinClassToCabin[bundle.cabinclass]
        const miles = parseInt(bundle.points, 10)
        const fare: FlightFare = {
          miles,
          cash: parseFloat(bundle.fareTax),
          currencyOfCash: raw.currency,
          cabin,
          isSaverFare: undefined,
          scraper: "jetblue"
        }

        let existingFare = result.fares.find((prevFare) => prevFare.cabin === cabin)
        if (existingFare !== undefined) {
          if (miles < existingFare.miles)
            existingFare = { ...fare }
        } else {
          result.fares.push(fare)
        }
      })
    })

    results.push(result)
  })

  return results
}

module.exports = scraper
