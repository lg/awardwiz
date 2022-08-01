/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { beforeEach, describe, expect, it } from "vitest"
import puppeteer from "puppeteer"
import moment_ from "moment"
import { FlightFare, FlightWithFares } from "../types/scrapers"
const moment = moment_

type Route = [orig: string, dest: string, expectFlight?: string]
type ScraperConfig = Record<string, {
  popularRoute: Route,     // expect at least one result
  partnerRoute?: Route,    // expect a search to come up with partner availability
  plusOneDayRoute: Route   // expect a flight to land the day after it takes off
  missingFareAttribs?: (keyof FlightFare)[]     // if we know a scraper is missing a certain field
}>
const scrapers: ScraperConfig = {
  aa: { popularRoute: ["SFO", "LAX"], partnerRoute: ["NRT", "SFO", "JL 58"], plusOneDayRoute: ["SFO", "JFK"] },
  aeroplan: { popularRoute: ["YOW", "YYZ"], partnerRoute: ["NRT", "CGK", "NH 835"], plusOneDayRoute: ["SFO", "EWR"] },
  alaska: { popularRoute: ["SFO", "JFK"], partnerRoute: ["SFO", "DUB", "EI 60"], plusOneDayRoute: ["HNL", "SFO"], missingFareAttribs: ["bookingClass"] },
  delta: { popularRoute: ["SFO", "JFK"], partnerRoute: ["LIH", "OGG", "HA 140"], plusOneDayRoute: ["LAX", "JFK"] },
  jetblue: { popularRoute: ["SFO", "JFK"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "JFK"] },
  southwest: { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"] },
  united: { popularRoute: ["SFO", "JFK"], partnerRoute: ["NRT", "CGK", "NH 835"], plusOneDayRoute: ["SFO", "EWR"] },
  // skiplagged
  // skyscanner
}

type KeysEnum<T> = { [_ in keyof Required<T>]: true }

describe.each(Object.keys(scrapers))("%o scraper", async (scraperName) => {
  let browser: puppeteer.Browser
  let context: puppeteer.BrowserContext
  let page: puppeteer.Page

  beforeAll(async () => { browser = await puppeteer.connect({ browserWSEndpoint: "ws://10.0.1.96:4000", defaultViewport: { width: 1400, height: 800 } }) })
  beforeEach(async () => { context = await browser.createIncognitoBrowserContext(); page = await context.newPage() })
  afterEach(async () => { await page.close().catch(() => {}); await context.close().catch(() => {}) })
  afterAll(async () => { await setTimeout(() => { browser.close().catch(() => {}) }, 1000) })

  const scraper = scrapers[scraperName]
  const scraperModule: typeof import("../scrapers/alaska") = await import(`../scrapers/${scraperName}`)
  const defCheckDate = moment().add(3, "months").format("YYYY-MM-DD")
  const debugText = `(${scraper.popularRoute[0]}->${scraper.popularRoute[1]} ${defCheckDate})`
  const runQuery = async (route: [orig: string, dest: string], checkDate = defCheckDate) => {
    return scraperModule.scraper({ page, context: { origin: route[0], destination: route[1], departureDate: checkDate } })
  }

  it(`can do a basic popular search ${debugText}`, async () => {
    const results = await runQuery([scraper.popularRoute[0], scraper.popularRoute[1]])

    expect(results.data.flightsWithFares.length).toBeGreaterThanOrEqual(1)
    expect(results.data.flightsWithFares.every((flight) => flight.fares.length > 0)).toBe(true)
    expect(results.data.flightsWithFares.every((flight) => flight.fares.every((fare) => fare.miles > 1000))).toBe(true)

    // Ensure that there there are no unexpected missing attributes
    const expectedFlightKeys: KeysEnum<FlightWithFares> = { flightNo: true, departureDateTime: true, arrivalDateTime: true, origin: true, destination: true, duration: true, fares: true, aircraft: true, amenities: true }
    results.data.flightsWithFares.forEach((flight: Record<string, any>) => {
      const undefinedFlightKeys = Object.keys(expectedFlightKeys).filter((check) => flight[check] === undefined)
      expect(undefinedFlightKeys, `Expected flight \n\n${JSON.stringify(flight)}\n\n to not have any undefined keys`).toEqual([])

      const expectedFareKeys: KeysEnum<Omit<FlightFare, "isSaverFare">> = { cabin: true, miles: true, bookingClass: true, cash: true, currencyOfCash: true, scraper: true }
      flight.fares.forEach((fare: Record<string, any>) => {
        const undefinedFareKeys = Object.keys(expectedFareKeys).filter((check) => fare[check] === undefined && !(scraper.missingFareAttribs?.includes(check as keyof FlightFare)))
        expect(undefinedFareKeys, `Expected flight \n\n${JSON.stringify(flight)}\n\n and fare \n\n${JSON.stringify(fare)}\n\n to not have any undefined keys`).toEqual([])
      })
    })
  })

  // it("fails gracefully with historic searches", async () => {
  //   const results = await runQuery([scraper.popularRoute[0], scraper.popularRoute[1]], moment().subtract(1, "week").format("YYYY-MM-DD"))
  //   expect(results.data.flightsWithFares.length).toBe(0)
  // })

  // it.only("fails gracefully with unserved airports", async () => {
  //   const results = await runQuery(["SFO", "OGS"])
  //   expect(results.data.flightsWithFares.length).toBe(0)
  // })

  it.runIf(scrapers[scraperName].partnerRoute)("can search partner availability", async () => {
    const results = await runQuery([scraper.partnerRoute![0], scraper.partnerRoute![1]])
    const expectFlightNo = scraper.partnerRoute![2]
    expect(results.data.flightsWithFares.find((flight) => {
      return flight.flightNo === expectFlightNo
    }), `flight ${expectFlightNo} to have partner availability`).toBeTruthy()
  })

  // it.todo("can properly deal with day +1 arrival", async () => { }, 20000)
  // it.todo("fails gracefully when no results", async () => { }, 20000)
  // it.todo("properly classifies domestic 'first' as business", async () => { }, 20000)
  // it.todo("properly classifies domestic 'first' as business unless lieflat", async () => { }, 20000)
  // it.todo("properly classifies first flights", async () => { }, 20000)
  // it.todo("properly classifies first flights with partners", async () => { }, 20000)
})

export { }
