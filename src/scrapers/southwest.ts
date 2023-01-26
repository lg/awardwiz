import { gotoPage, waitFor, waitForLocatorAndClick } from "../common.js"
import { AwardWizScraper, FlightFare, FlightWithFares } from "../types.js"
import { SouthwestResponse } from "./samples/southwest.js"
import c from "ansi-colors"
import { ScraperMetadata } from "../scraper.js"
import { Response } from "playwright"

export const meta: ScraperMetadata = {
  name: "southwest",
  forceCacheUrls: ["*/swa-ui/*", "*/assets/app/scripts/swa-common.js", "*/swa-resources/{images,fonts,styles,scripts}/*",
    "*/swa-resources/config/status.js"],
  useAdblockLists: true,    // i think sometimes keeping this as false helps with not getting blocked, TBD
  useBrowsers: ["firefox", "chromium"],  // webkit has issues re- using http/1.1 vs http/2 on docker vs macos (which southwest likely detects)
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  // TODO: i think we can go to: https://www.southwest.com/air/booking/select.html?adultPassengersCount=1&adultsCount=1&departureDate=2023-02-05&departureTimeOfDay=ALL_DAY&destinationAirportCode=HNL&fareType=POINTS&originationAirportCode=OAK&passengerType=ADULT&returnDate=&returnTimeOfDay=ALL_DAY&tripType=oneway
  await gotoPage(sc, "https://www.southwest.com/air/booking/", "networkidle")

  sc.log("start")
  sc.page.setDefaultTimeout(15000)

  await sc.page.getByLabel("One-way").check()
  await sc.page.getByLabel("Points").check()

  await sc.page.getByRole("combobox", { name: "Depart" }).fill(query.origin)
  if (!await waitForLocatorAndClick(
    sc.page.getByRole("button", { name: new RegExp(` - ${query.origin}$`, "g") }),
    sc.page.getByRole("option", { name: "No match found" })
  )) {
    sc.log(c.yellow("WARN: origin not found")) ; return []
  }

  await sc.page.getByRole("combobox", { name: "Arrive" }).fill(query.destination)
  if (!await waitForLocatorAndClick(
    sc.page.getByRole("button", { name: new RegExp(` - ${query.destination}$`, "g") }),
    sc.page.getByRole("option", { name: "No match found" })
  )) {
    sc.log(c.yellow("WARN: destination not found")) ; return []
  }

  await sc.page.getByLabel(/^Depart Date {2}.*/u).fill(query.departureDate.substring(5).replace("-", "/")).then(() =>
    sc.page.getByLabel(/^Depart Date {2}.*/u).press("Escape"))

  sc.log("waiting for response")
  void sc.page.getByRole("button", { name: /^Search button\./u }).click().catch(() => {})

  let xhrResponse: Response | undefined
  const searchResult = await waitFor(sc, {
    "bad departure date": sc.page.getByText("Enter depart date."),
    "xhr": sc.page.waitForResponse("https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping").then((resp) => xhrResponse = resp),
    "html": sc.page.waitForSelector("#price-matrix-heading-0")
  })

  let raw: SouthwestResponse
  if (searchResult === "xhr") {
    sc.log("got xhr response")
    raw = await xhrResponse!.json() as SouthwestResponse
    if (raw.code === 403050700)       // the code for "we know youre a bot"
      throw new Error("Failed with anti-botting error")
    if (!raw.success)
      throw new Error(`Failed to retrieve response: ${JSON.stringify(raw.notifications?.formErrors ?? raw.code)}`)

  } else if (searchResult === "html") {
    sc.log("got html response")
    raw = { success: true, uiMetadata: undefined!, data: { searchResults: await sc.page.evaluate(() => (window as any).data_a.stores.AirBookingSearchResultsSearchStore.searchResults) } }

  } else {
    sc.log(c.yellow(`WARN: ${searchResult}`))
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
