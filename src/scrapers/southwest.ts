import type { FlightFare, FlightWithFares } from "../types/scrapers"
import { browserlessInit, equipmentTypeLookup, gotoPage, log, processScraperFlowRules, Scraper, ScraperFlowRule, ScraperMetadata } from "./common"
import type { SouthwestResponse } from "./samples/southwest"

const meta: ScraperMetadata = {
  name: "southwest",
  blockUrls: [
    "/scripts/analytics/", "api/logging", "__imp_apg__",
    "techlab-cdn.com", "zeronaught.com", "mpeasylink.com", "favicon.ico", "go-mpulse.net",
    "www.uplift-platform.com"
  ],
}

export const scraper: Scraper = async (page, query) => {
  await gotoPage(page, "https://www.southwest.com/air/booking/", "networkidle0")
  await processScraperFlowRules(page, [
    { find: "input[value='oneway']", andWaitFor: "input:checked[value='oneway']", done: true },
  ])

  const genAirportSearchRule = (airportCode: string, selector: string): ScraperFlowRule => ({
    find: selector,
    type: airportCode,
    andThen: [
      { find: `button[aria-label~=${airportCode}]`, andWaitFor: ".overlay-background[style='']", done: true },
      { find: `${selector}[aria-label='No match found']`, throw: "airport not found" },
    ]
  })

  const items = [
    { find: "input[value='POINTS']", andWaitFor: "input:checked[value='POINTS']" },
    genAirportSearchRule(query.origin, "input#originationAirportCode"),
    genAirportSearchRule(query.destination, "input#destinationAirportCode"),
    {
      find: "input#departureDate",
      type: `${parseInt(query.departureDate.substring(5, 7), 10)}/${parseInt(query.departureDate.substring(8, 10), 10)}`,
      andThen: [
        { find: `button[id*='${query.departureDate}']`, andWaitFor: ".overlay-background[style='']", done: true },
        { find: "button[aria-label='Next Month'][disabled]", throw: "date not found" },
        { find: "button[aria-label='Next Month']", reusable: true },
      ]
    }
  ] as ScraperFlowRule[]
  const scraperFlowResult = await processScraperFlowRules(page, items.sort((a, b) => Math.random() - 0.5)).catch((e) => {
    if (e.message === "airport not found" || e.message === "date not found")
      return e.message
    throw e
  })

  if (scraperFlowResult === "airport not found" || scraperFlowResult === "date not found") {
    log(scraperFlowResult)
    return []
  }

  // Clicking the southwest find button sometimes will redirect back with an error (usually botting)
  log("clicking submit button")
  await page.waitForSelector("#form-mixin--submit-button").then((el: any) => el.click())

  log("waiting for response")
  const raw = await page.waitForResponse("https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping", { timeout: 5000 })
    .then((rawResponse) => rawResponse.json() as Promise<SouthwestResponse>)

  if (!raw.success || raw.code === 403050700) // that code is for "we know youre a bot"
    throw new Error(`Failed to retrieve response: ${JSON.stringify(raw.notifications?.formErrors ?? raw.code)}`)

  // Even if results is undefined, because of the of the 'raw.success' above we're assuming it's ok
  const results = raw.data?.searchResults?.airProducts[0].details ?? []
  if (raw.notifications?.formErrors?.some((formError) => formError.code === "ERROR__NO_ROUTES_EXIST"))
    log("No routes exist between the origin and destination")

  const flights: FlightWithFares[] = results.map((result) => {
    if (result.flightNumbers.length > 1)
      return
    if (!result.fareProducts)   // this will sometimes be missing when a flight has already taken off for same-day flights
      return

    const flight: FlightWithFares = {
      departureDateTime: result.departureDateTime.substring(0, 19).replace("T", " "),
      arrivalDateTime: result.arrivalDateTime.substring(0, 19).replace("T", " "),
      origin: result.originationAirportCode,
      destination: result.destinationAirportCode,
      flightNo: `${result.segments[0].operatingCarrierCode} ${result.segments[0].flightNumber}`,
      duration: result.totalDuration,
      aircraft: equipmentTypeLookup[result.segments[0].aircraftEquipmentType],
      fares: [],
      amenities: {
        hasPods: undefined,
        hasWiFi: result.segments[0].wifiOnBoard,
      }
    }
    const bestFare = Object.values(result.fareProducts.ADULT).reduce<FlightFare | undefined>((lowestFare: FlightFare | undefined, product) => {
      if (product.availabilityStatus !== "AVAILABLE")
        return lowestFare
      const fare: FlightFare = {
        cabin: "economy",
        miles: parseInt(product.fare.totalFare.value, 10),
        bookingClass: product.productId.split(",")[1],
        cash: parseFloat(product.fare.totalTaxesAndFees.value),
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

module.exports = (params: any) => browserlessInit(meta, scraper, params)
