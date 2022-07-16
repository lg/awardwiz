/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import { HTTPResponse } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperFunc } from "../types/scrapers"
import { equipmentTypeLookup, processScraperFlowRules, sleep } from "./common"
type SouthwestTypes = typeof import("./extra/southwest_sample.json")
type SouthwestErrorTypes = { code: number, notifications: { formErrors: { code: string }[] } }

export type ScraperFlowRule = {
  find: string
  type?: string
  done?: true
  andWaitFor?: string
  andDebugger?: true
  andThen?: ScraperFlowRule[]
}

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  page.goto("https://www.southwest.com/air/booking/")
  await page.waitForNavigation({ waitUntil: "networkidle0" })

  const rules: ScraperFlowRule[] = [
    { find: "input[value='oneway']", andWaitFor: "input:checked[value='oneway']" },
    { find: "input[value='POINTS']", andWaitFor: "input:checked[value='POINTS']" },
    { find: "input#originationAirportCode", type: query.origin, andThen: [{ find: `button[aria-label~=${query.origin}]`, andWaitFor: ".overlay-background[style='']", done: true }] },
    { find: "input#destinationAirportCode", type: query.destination, andThen: [{ find: `button[aria-label~=${query.destination}]`, andWaitFor: ".overlay-background[style='']", done: true }] },
    { find: "input#departureDate", type: `${parseInt(query.departureDate.substring(5, 7), 10)}/${parseInt(query.departureDate.substring(8, 10), 10)}`, andThen: [{ find: `button[id*='${query.departureDate}']`, andWaitFor: ".overlay-background[style='']", done: true }] },
    { find: "#form-mixin--submit-button", done: true },
  ]

  await processScraperFlowRules(page, rules)

  let raw: SouthwestTypes
  let tries = 0
  do {
    raw = await page.waitForResponse("https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping").then((response: HTTPResponse) => response.json())
    if (raw.success)
      break

    tries += 1
    if (tries === 5)
      throw new Error("Failed after trying 5 times to load southwest searches")
    // console.log("waiting 5 seconds and trying again")
    await sleep(5000)
    page.click("#form-mixin--submit-button")
  } while ((raw as unknown as SouthwestErrorTypes).code === 403050700)

  const { notifications } = (raw as unknown as SouthwestErrorTypes)
  if (notifications && notifications.formErrors && notifications.formErrors[0] && notifications.formErrors[0].code === "ERROR__NO_ROUTES_EXIST")
    return { data: { flightsWithFares: [] } }

  const rawResults = raw.data.searchResults.airProducts[0].details

  const flights: FlightWithFares[] = rawResults.map((result) => {
    if (result.flightNumbers.length > 1)
      return undefined

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
    const bestFare: FlightFare | undefined = Object.values(result.fareProducts.ADULT).reduce((lowestFare: FlightFare | undefined, product) => {
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
    }, undefined as FlightFare | undefined)

    if (bestFare)
      flight.fares.push(bestFare)

    return bestFare ? flight : undefined
  }).filter((flight: FlightWithFares | undefined) => flight !== undefined).map((x) => x as FlightWithFares)

  return { data: { flightsWithFares: flights } }
}

module.exports = scraper
