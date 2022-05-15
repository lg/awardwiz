/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-loops/no-loops */
/* eslint-disable no-await-in-loop */

import { Page } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperCapabilities, ScraperFunc } from "../types/scrapers"
import SouthwestTypes from "./southwest-types"

export const capabilities: ScraperCapabilities = {
  missingAttributes: [],
  missingFareAttributes: ["isSaverFare"]
}

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
    { find: "input#destinationAirportCode", type: query.destination, andThen: [{ find: `button[aria-label~=${query.destination}]`, done: true }] },
    { find: "input#originationAirportCode", type: query.origin, andThen: [{ find: `button[aria-label~=${query.origin}]`, done: true }] },
    { find: "input#departureDate", type: `${parseInt(query.departureDate.substring(5, 7), 10)}/${parseInt(query.departureDate.substring(8, 10), 10)}`, andThen: [{ find: `button[id*='${query.departureDate}']`, done: true }] },
    { find: "input[value='oneway']", andWaitFor: "input:checked[value='oneway']" },
    { find: "input[value='POINTS']", andWaitFor: "input:checked[value='POINTS']" },
    { find: "#form-mixin--submit-button", done: true },
  ]

  await processScraperFlowRules(page, rules)

  const raw: SouthwestTypes.Result = await page.waitForResponse("https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping").then((response: Response) => response.json())

  if (raw.notifications && raw.notifications.formErrors && raw.notifications.formErrors[0] && raw.notifications.formErrors[0].code === "ERROR__NO_ROUTES_EXIST")
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
      hasWifi: result.segments[0].wifiOnBoard,
      fares: []
    }
    const bestFare: FlightFare | undefined = (Object.values(result.fareProducts.ADULT) as SouthwestTypes.Red[]).reduce((lowestFare: FlightFare | undefined, product) => {
      if (product.availabilityStatus !== "AVAILABLE")
        return lowestFare
      const fare: FlightFare = {
        cabin: "economy",
        miles: parseInt(product.fare.totalFare.value, 10),
        isSaverFare: false,
        cash: parseFloat(product.fare.totalTaxesAndFees.value),
        currencyOfCash: product.fare.totalTaxesAndFees.currencyCode
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

    await matchedRule.element.click()

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
