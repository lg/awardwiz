/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import { HTTPResponse, Page } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperCapabilities, ScraperFunc } from "../types/scrapers"
type SouthwestTypes = typeof import("./extra/southwest_sample.json")
type SouthwestErrorTypes = { code: number, notifications: { formErrors: { code: string }[] } }

export const capabilities: ScraperCapabilities = {
  missingAttributes: [],
  missingFareAttributes: ["bookingClass"]
}

export type ScraperFlowRule = {
  find: string
  type?: string
  done?: true
  andWaitFor?: string
  andDebugger?: true
  andThen?: ScraperFlowRule[]
}

// from https://www.southwest.com/swa-ui/bootstrap/air-booking/1/data.js
const aircraftLookup: {[equipmentType: string]: string} = {
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
      aircraft: aircraftLookup[result.segments[0].aircraftEquipmentType],
      fares: [],
      amenities: {}
    }
    const bestFare: FlightFare | undefined = Object.values(result.fareProducts.ADULT).reduce((lowestFare: FlightFare | undefined, product) => {
      if (product.availabilityStatus !== "AVAILABLE")
        return lowestFare
      const fare: FlightFare = {
        cabin: "economy",
        miles: parseInt(product.fare.totalFare.value, 10),
        bookingClass: undefined,
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

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) })
export const processScraperFlowRules = async (page: Page, rules: ScraperFlowRule[]): Promise<void> => {
  const skipIndexes: number[] = []

  const matchNextRule = async () => {
    if (skipIndexes.length === rules.length)
      return undefined
    const matchAll = async () => {
      const startTime = Date.now()

      while (true) {
        for (let i = 0; i < rules.length; i += 1) {
          if (skipIndexes.includes(i))
            continue
          const element = await page.$(rules[i].find)
          if (!element)
            continue
          return { index: i, element }
        }
        await sleep(100)
        if (Date.now() - startTime > 10000)
          return undefined
      }
    }
    const match = await matchAll()
    if (!match)
      return undefined
    skipIndexes.push(match.index)
    return { element: match.element!, rule: rules[match.index] }
  }

  while (true) {
    const matchedRule = await matchNextRule()
    if (!matchedRule)
      throw new Error("No matches")

    // console.log("matched rule", matchedRule.rule.find)
    await sleep(400)
    const clickEvent = matchedRule.element.click()
    if (!matchedRule.rule.done)
      await clickEvent

    if (matchedRule.rule.type) {
      await matchedRule.element.focus()
      await matchedRule.element.type(matchedRule.rule.type)
    }

    if (matchedRule.rule.andWaitFor)
      await page.waitForSelector(matchedRule.rule.andWaitFor)

    if (matchedRule.rule.andThen)
      await processScraperFlowRules(page, matchedRule.rule.andThen)

    if (matchedRule.rule.andDebugger)
      debugger

    if (matchedRule.rule.done)
      break
  }
}

module.exports = scraper
