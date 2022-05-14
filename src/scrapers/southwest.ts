/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-loops/no-loops */
/* eslint-disable no-await-in-loop */

import { Page } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperCapabilities, ScraperFunc } from "../types/scrapers"

export const capabilities: ScraperCapabilities = {
  supportsConnections: false,
  missingAttributes: []
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
  await page.goto("https://www.southwest.com/air/booking/")

  const rules: ScraperFlowRule[] = [
    { find: "input#destinationAirportCode", type: query.destination, andThen: [{ find: `button[aria-label~=${query.destination}]`, done: true }] },
    { find: "input#originationAirportCode", type: query.origin, andThen: [{ find: `button[aria-label~=${query.origin}]`, done: true }] },
    { find: "input#departureDate", type: `${parseInt(query.departureDate.substring(5, 7), 10)}/${parseInt(query.departureDate.substring(8, 10), 10)}`,
      andThen: [{ find: `button[id*='${query.departureDate}']`, done: true }] },
    { find: "input[value='oneway']", andWaitFor: "input:checked[value='oneway']" },
    { find: "input[value='POINTS']", andWaitFor: "input:checked[value='POINTS']" },
    { find: "#form-mixin--submit-button", done: true },
  ]

  await processScraperFlowRules(page, rules)

  const raw = await page.waitForResponse("https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping").then((response: Response) => response.json())
  if (raw.notifications && raw.notifications.formErrors && raw.notifications.formErrors[0] && raw.notifications.formErrors[0].code === "ERROR__NO_ROUTES_EXIST")
    return { data: { flightsWithFares: [] } }

  //debugger

  const rawResults = raw.data.searchResults.airProducts[0].details

  const flights: FlightWithFares[] = rawResults.map((result: any) => {
    if (result.flightNumbers.length > 1)
      return undefined

    const flight: FlightWithFares = {
      departureDateTime: result.departureDateTime.substr(0, 19).replace("T", " "),
      arrivalDateTime: result.arrivalDateTime.substr(0, 19).replace("T", " "),
      origin: result.originationAirportCode,
      destination: result.destinationAirportCode,
      flightNo: `${result.segments[0].operatingCarrierCode} ${result.segments[0].flightNumber}`,
      duration: result.totalDuration,
      hasWifi: result.segments[0].wifiOnBoard,
      fares: [Object.values(result.fareProducts.ADULT).reduce((lowestFare: any, product: any) => {
        if (product.availabilityStatus !== "AVAILABLE")
          return undefined
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
      }, undefined)] as FlightFare[]
    }
    return flight
  }).filter((flight: FlightWithFares | undefined) => flight !== undefined)

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
      console.log(`on skiplist: ${skipIndexes.join(",")}`)

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
    console.log("Waiting for next match")
    const matchedRule = await matchNextRule()
    if (!matchedRule)
      throw new Error("No matches")

    console.log(`Matched rule '${matchedRule.rule.find}')`)
    await matchedRule.element.click()

    if (matchedRule.rule.type) {
      console.log(`  Typing '${matchedRule.rule.type}'`)
      await matchedRule.element.focus()
      await matchedRule.element.type(matchedRule.rule.type)
    }

    if (matchedRule.rule.andWaitFor) {
      console.log(`  Waiting for '${matchedRule.rule.andWaitFor}'`)
      await page.waitForSelector(matchedRule.rule.andWaitFor)
    }

    if (matchedRule.rule.andThen) {
      console.log(`  Processing more rules (${matchedRule.rule.andThen.length})`)
      await processScraperFlowRules(page, matchedRule.rule.andThen)
    }

    if (matchedRule.rule.andDebugger) {
      debugger
    }

    if (matchedRule.rule.done) {
      console.log("  Done")
      break
    }
  }
}

module.exports = scraper
