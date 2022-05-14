import { beforeEach, describe, expect, it } from "vitest"
import puppeteer from "puppeteer"
import moment from "moment"
import { FlightWithFares } from "../types/scrapers"

type ScraperConfig = { [key: string]: { popularRoute: { origin: string; destination: string }} }
const scrapers: ScraperConfig = {
  alaska: { popularRoute: { origin: "SFO", destination: "JFK" } },
  united: { popularRoute: { origin: "SFO", destination: "JFK" } },
  southwest: { popularRoute: { origin: "SFO", destination: "LAX" } },
}

describe.each(Object.keys(scrapers))("%o scraper", (scraperName) => {
  let browser: puppeteer.Browser
  let context: puppeteer.BrowserContext
  let page: puppeteer.Page

  beforeAll(async () => { browser = await puppeteer.connect({ browserWSEndpoint: "ws://localhost:4000" }) })
  beforeEach(async () => { context = await browser.createIncognitoBrowserContext(); page = await context.newPage() })
  afterEach(async () => { await page.close(); await context.close() })
  afterAll(async () => { await setTimeout(() => { browser.close() }, 1000) })

  it("can do a basic popular search", async () => {
    const scraperModule: typeof import("../scrapers/alaska") = await import(`../scrapers/${scraperName}`)
    const results = await scraperModule.scraper({ page, context: { origin: scrapers[scraperName].popularRoute.origin, destination: scrapers[scraperName].popularRoute.destination, departureDate: moment().add(2, "months").format("YYYY-MM-DD") } })

    expect(results.data.flightsWithFares.length).toBeGreaterThanOrEqual(1)
    expect(results.data.flightsWithFares.every((flight) => flight.fares.length > 0)).toBe(true)
    expect(results.data.flightsWithFares.every((flight) => flight.fares.every((fare) => fare.miles > 1000))).toBe(true)

    // eslint-disable-next-line no-unused-vars
    type KeysEnum<T> = { [P in keyof Required<T>]: true };
    const expectedKeys: KeysEnum<FlightWithFares> = { flightNo: true, departureDateTime: true, arrivalDateTime: true, origin: true, destination: true, airline: true, duration: true, fares: true }
    expect(results.data.flightsWithFares.every((flight) => {
      return Object.keys(expectedKeys).every((key) => {
        const val = Object.entries(flight).find(([k, v]) => k === key)?.[1]
        return val !== undefined || (val === undefined && scraperModule.capabilities.missingAttributes.includes(key as keyof FlightWithFares))
      })
    })).toBe(true)
  }, 20000)

  it.todo("can search partner availability", async () => {})
  it.todo("can properly deal with day +1 arrival", async () => {})
  it.todo("supports zero results", async () => {})
})
