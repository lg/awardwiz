import { beforeEach, describe, expect, it } from "vitest"
import puppeteer from "puppeteer"
import moment_ from "moment"
const moment = moment_

type Route = [orig: string, dest: string, expectFlight?: string]
type ScraperConfig = Record<string, {
  popularRoute: Route,     // expect at least one result
  partnerRoute?: Route,    // expect a search to come up with partner availability
  plusOneDayRoute: Route   // expect a flight to land the day after it takes off
}>
const scrapers: ScraperConfig = {
  aeroplan: { popularRoute: ["YOW", "YYZ"], partnerRoute: ["NRT", "CGK", "NH 835"], plusOneDayRoute: ["SFO", "EWR"] },
  alaska: { popularRoute: ["SFO", "JFK"], partnerRoute: ["HKG", "KUL", "MH 79"], plusOneDayRoute: ["HNL", "SFO"] },
  united: { popularRoute: ["SFO", "JFK"], partnerRoute: ["NRT", "CGK", "NH 835"], plusOneDayRoute: ["SFO", "EWR"] },
  southwest: { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"] },
  jetblue: { popularRoute: ["SFO", "JFK"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "JFK"] }
}

// eslint-disable-next-line no-unused-vars
// type KeysEnum<T> = { [P in keyof Required<T>]: true }

describe.each(Object.keys(scrapers))("%o scraper", async (scraperName) => {
  let browser: puppeteer.Browser
  let context: puppeteer.BrowserContext
  let page: puppeteer.Page

  beforeAll(async () => { browser = await puppeteer.connect({ browserWSEndpoint: "ws://10.0.1.17:4000" }) })
  beforeEach(async () => { context = await browser.createIncognitoBrowserContext(); page = await context.newPage() })
  afterEach(async () => { await page.close(); await context.close() })
  afterAll(async () => { await setTimeout(() => { browser.close() }, 1000) })

  const scraper = scrapers[scraperName]
  const scraperModule: typeof import("../scrapers/alaska") = await import(`../scrapers/${scraperName}`)
  const runQuery = async (route: [orig: string, dest: string], checkDate = moment().add(3, "months").format("YYYY-MM-DD")) => {
    return scraperModule.scraper({ page, context: { origin: route[0], destination: route[1], departureDate: checkDate } })
  }

  it("can do a basic popular search", async () => {
    const results = await runQuery([scraper.popularRoute[0], scraper.popularRoute[1]])

    expect(results.data.flightsWithFares.length).toBeGreaterThanOrEqual(1)
    expect(results.data.flightsWithFares.every((flight) => flight.fares.length > 0)).toBe(true)
    expect(results.data.flightsWithFares.every((flight) => flight.fares.every((fare) => fare.miles > 1000))).toBe(true)

    // Ensure that there there are no unexpected missing attributes
    // const expectedKeys: KeysEnum<FlightWithFares> = { flightNo: true, departureDateTime: true, arrivalDateTime: true, origin: true, destination: true, duration: true, fares: true, aircraft: true, amenities: true }
    // expect(results.data.flightsWithFares.every((flight) => {
    //   return Object.keys(expectedKeys).every((key) => {
    //     const val = Object.entries(flight).find(([k, v]) => k === key)?.[1]
    //     return val !== undefined || (val === undefined && scraperModule.capabilities.missingAttributes.includes(key as keyof FlightWithFares))
    //   })
    // })).toBe(true)

    // Ensure that there there are no unexpected missing fare attributes
    // const expectedFareKeys: KeysEnum<FlightFare> = { cabin: true, miles: true, bookingClass: true, cash: true, currencyOfCash: true, scraper: true, isSaverFare: true }
    // expect(results.data.flightsWithFares.every((flight) => {
    //   return flight.fares.every((fare) => {
    //     return Object.keys(expectedFareKeys).every((key) => {
    //       const val = Object.entries(fare).find(([k, v]) => k === key)?.[1]
    //       return val !== undefined || (val === undefined && scraperModule.capabilities.missingFareAttributes.includes(key as keyof FlightFare))
    //     })
    //   })
    // })).toBe(true)
  }, 20000)

  // it("fails gracefully with historic searches", async () => {
  //   const results = await runQuery([scraper.popularRoute[0], scraper.popularRoute[1]], moment().subtract(1, "week").format("YYYY-MM-DD"))
  //   expect(results.data.flightsWithFares.length).toBe(0)
  // })

  // it.runIf(scrapers[scraperName].partnerRoute)("can search partner availability", async () => {
  //   const results = await runQuery([scraper.partnerRoute![0], scraper.partnerRoute![1]])
  //   const expectFlightNo = scraper.partnerRoute![2]
  //   expect(results.data.flightsWithFares.find((flight) => {
  //     return flight.flightNo === expectFlightNo
  //   }), `flight ${expectFlightNo} to have partner availability`).toBeTruthy()
  // }, 20000)

  // it.todo("can properly deal with day +1 arrival", async () => { }, 20000)
  // it.todo("fails gracefully when no results", async () => { }, 20000)
  // it.todo("properly classifies domestic 'first' as business", async () => { }, 20000)
  // it.todo("properly classifies domestic 'first' as business unless lieflat", async () => { }, 20000)
  // it.todo("properly classifies first flights", async () => { }, 20000)
  // it.todo("properly classifies first flights with partners", async () => { }, 20000)
})

export { }
