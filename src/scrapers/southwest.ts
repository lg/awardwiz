import { AwardWizScraper, FlightFare, FlightWithFares } from "../types.js"
import { SouthwestResponse } from "./samples/southwest.js"
import c from "ansi-colors"
import { ScraperMetadata } from "../scraper.js"

export const meta: ScraperMetadata = {
  name: "southwest",
  blockUrls: ["go-mpulse.net", "*.mpeasylink.com", "cdn.branch.io", "*.demdex.net", "www.uplift-platform.com",
    "app.link", "smetrics.southwest.com", "soptimize.southwest.com"]
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  const paramsText = `adultPassengersCount=1&adultsCount=1&departureDate=${query.departureDate}&departureTimeOfDay=ALL_DAY&destinationAirportCode=${query.destination}&fareType=POINTS&originationAirportCode=${query.origin}&passengerType=ADULT&returnDate=&returnTimeOfDay=ALL_DAY&tripType=oneway`
  const paramsTextRandomized = paramsText.split("&").sort((a, b) => Math.random() - 0.5).join("&")
  const url = `https://www.southwest.com/air/booking/select.html?${paramsTextRandomized}`
  sc.browser.goto(url)

  sc.log("waiting for response")
  const waitForResult = await sc.browser.waitFor({
    "bad departure date": { type: "html", html: "Date must be in the future." },
    "bad origin": { type: "html", html: "Enter departure airport." },
    "bad destination": { type: "html", html: "Enter arrival airport." },
    "xhr": { type: "url", url: "https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping" },
    "html": { type: "html", html: "#price-matrix-heading-0" }
  })

  let raw: SouthwestResponse
  if (waitForResult.name === "xhr") {
    sc.log("got xhr response")
    raw = JSON.parse(waitForResult.response?.body) as SouthwestResponse

    if (raw.notifications?.formErrors?.some((formError) => formError.code === "ERROR__NO_FLIGHTS_AVAILABLE")) {
      sc.log(c.yellow("WARN: No flights available (likely bad date)"))
      return []
    } else if (raw.notifications?.fieldErrors?.some((formError) => formError.code === "ERROR__AIRPORT__INVALID")) {
      sc.log(c.yellow("WARN: invalid origin/destination"))
      return []
    } else if (raw.notifications?.formErrors?.some((formError) => formError.code === "ERROR__NO_FARE_FOUND")) {
      throw new Error("Failed to find fares, retry plz")
    }
    if (raw.code === 403050700)       // the code for "we know youre a bot"
      throw new Error("Failed with anti-botting error")
    if (!raw.success)
      throw new Error(`Failed to retrieve response: ${JSON.stringify(raw.notifications?.formErrors ?? raw.notifications?.fieldErrors ?? raw)}`)

  } else if (waitForResult.name === "html") {
    sc.log("got html response")
    raw = { success: true, uiMetadata: undefined!, data: {
      searchResults: await sc.browser.evaluate("(window as any).data_a.stores.AirBookingSearchResultsSearchStore.searchResults")
    }}

  } else {
    sc.log(c.yellow(`WARN: ${waitForResult.name}`))
    return []
  }

  // Even if results is undefined, because of the of the 'raw.success' above we're assuming it's ok
  const results = raw.data?.searchResults?.airProducts[0]?.details ?? []
  if (raw.notifications?.formErrors?.some((formError) => formError.code === "ERROR__NO_ROUTES_EXIST"))
    sc.log("No routes exist between the origin and destination")

  const flights: FlightWithFares[] = results.map((result) => {
    if (result.flightNumbers.length > 1)
      return
    if (!result.fareProducts)   // this will sometimes be missing when a flight has already taken off for same-day flights
      return

    const flight: FlightWithFares = {
      departureDateTime: result.departureDateTime.slice(0, 19).replace("T", " "),
      arrivalDateTime: result.arrivalDateTime.slice(0, 19).replace("T", " "),
      origin: result.originationAirportCode,
      destination: result.destinationAirportCode,
      flightNo: `${result.segments[0]!.operatingCarrierCode} ${result.segments[0]!.flightNumber}`,
      duration: result.totalDuration,
      aircraft: equipmentTypeLookup[result.segments[0]!.aircraftEquipmentType],
      fares: [],
      amenities: {
        hasPods: undefined,
        hasWiFi: result.segments[0]!.wifiOnBoard,
      }
    }
    const bestFare = Object.values(result.fareProducts.ADULT).reduce<FlightFare | undefined>((lowestFare: FlightFare | undefined, product) => {
      if (product.availabilityStatus !== "AVAILABLE")
        return lowestFare
      const fare: FlightFare = {
        cabin: "economy",
        miles: Number.parseInt(product.fare.totalFare.value, 10),
        bookingClass: product.productId.split(",")[1],
        cash: Number.parseFloat(product.fare.totalTaxesAndFees.value),
        currencyOfCash: product.fare.totalTaxesAndFees.currencyCode,
        scraper: "southwest"
      }

      if (!lowestFare || fare.miles < lowestFare.miles)
        return fare
      return lowestFare
    }, undefined)

    if (bestFare)
      flight.fares.push(bestFare)

    return bestFare ? flight : undefined
  }).filter((flight): flight is FlightWithFares => !!flight)

  return flights
}

const equipmentTypeLookup: Record<string, string> = {
  "717": "Boeing 717-200",
  "733": "Boeing 737-300",
  "735": "Boeing 737-500",
  "738": "Boeing 737-800",
  "7M7": "Boeing 737 MAX7",
  "7M8": "Boeing 737 MAX8",
  "73C": "Boeing 737-300",
  "73G": "Boeing 737-700",
  "73H": "Boeing 737-800",
  "73R": "Boeing 737-700",
  "7T7": "Boeing 737 MAX7",
  "73W": "Boeing 737-700",
  "7T8": "Boeing 737 MAX8"
}
