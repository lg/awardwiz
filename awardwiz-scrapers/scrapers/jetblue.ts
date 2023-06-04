import { ScraperMetadata } from "../../arkalis/arkalis.js"
import { FlightFare, FlightWithFares, AwardWizQuery, AwardWizScraper } from "../awardwiz-types.js"
import { JetBlueResponse } from "../scraper-types/jetblue.js"

export const meta: ScraperMetadata = {
  name: "jetblue",
  blockUrls: [
    "htp.tokenex.com", "sdk.jetbluevacations.com", "sentry.io", "btstatic.com", "trustarc.com", "asapp.com",
    "thebrighttag.com", "demdex.net", "somnistats.jetblue.com", "*appdynamics.com",
    "https://www.jetblue.com/magnoliaauthor/dam/ui-assets/imagery/destinations/large/*"
  ],
  defaultTimeoutMs: 40000
}

export const runScraper: AwardWizScraper = async (arkalis, query) => {
  const url = `https://www.jetblue.com/booking/flights?from=${query.origin}&to=${query.destination}&depart=${query.departureDate}&isMultiCity=false&noOfRoute=1&lang=en&adults=1&children=0&infants=0&sharedMarket=false&roundTripFaresFlag=false&usePoints=true`
  arkalis.goto(url)

  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "https://jbrest.jetblue.com/lfs-rwb/outboundLFS" },
    "no-flights": { type: "url", url: "https://www.jetblue.com/best-fare-finder?nff=true" },
    "prev-day": { type: "html", html: "The dates for your search cannot be in the past." },
  })
  if (waitForResult.name === "prev-day")
    return arkalis.warn("date in past")
  if (waitForResult.name === "no-flights")
    return arkalis.warn("no flights")
  if (waitForResult.name !== "success")
    throw new Error(waitForResult.name)
  if (waitForResult.response?.body === "Invalid Request")
    throw new Error("JetBlue returned 'Invalid Request' anti-botting response")

  const fetchFlights = JSON.parse(waitForResult.response!.body) as JetBlueResponse
  if (fetchFlights.error?.code === "JB_RESOURCE_NOT_FOUND") {
    return arkalis.warn("No scheduled flights between cities")
  } else if (fetchFlights.error) {
    throw new Error(`JetBlue error: ${fetchFlights.error.message}`)
  }

  arkalis.log("parsing results")
  const results = standardizeResults(fetchFlights, query)
  return results
}

const standardizeResults = (raw: JetBlueResponse, query: AwardWizQuery) => {
  const results: FlightWithFares[] = []
  for (const itinerary of raw.itinerary!) {
    if (itinerary.segments.length !== 1)
      continue
    const segment = itinerary.segments[0]!
    const durationText = /\w{2}(?<hours>\d{1,2})H(?:(?<minutes>\d+)M)?/u.exec(segment.duration)
    if (!durationText || durationText.length !== 3)
      throw new Error("Invalid duration for flight")

    const result: FlightWithFares = {
      departureDateTime: segment.depart.slice(0, 19).replace("T", " "),
      arrivalDateTime: segment.arrive.slice(0, 19).replace("T", " "),
      origin: segment.from,
      destination: segment.to,
      flightNo: `${segment.operatingAirlineCode} ${segment.flightno}`,
      duration: Number.parseInt(durationText.groups!["hours"]!, 10) * 60 + Number.parseInt(durationText.groups!["minutes"] ?? "0", 10),
      aircraft: segment.aircraft,
      fares: [],
      amenities: {
        hasPods: segment.aircraft.includes("/Mint"),
        hasWiFi: undefined,
      },
    }

    if (result.origin !== query.origin || result.destination !== query.destination)
      continue

    for (const bundle of itinerary.bundles) {
      if (bundle.status !== "AVAILABLE")
        continue

      const fareToAdd: FlightFare = {
        cabin: {"Y": "economy", "J": "business", "C": "business", "F": "first"}[bundle.cabinclass]!,
        miles: parseInt(bundle.points!),
        cash: parseFloat(bundle.fareTax ?? "0.00"),
        currencyOfCash: "USD",
        scraper: "jetblue",
        bookingClass: bundle.bookingclass,
        isSaverFare: undefined,
      }

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
