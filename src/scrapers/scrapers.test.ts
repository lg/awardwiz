/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable global-require */
/* eslint-disable import/no-extraneous-dependencies */

import { beforeEach, describe, expect, it } from "vitest"
import puppeteer = require("puppeteer")
import moment = require("moment")
import { FlightWithFares } from "../types/scrapers"

type ScraperConfig = {
  scraperName: string,
  popularRoute: { origin: string; destination: string }   // route should have award available all the time
}

const scrapers: ScraperConfig[] = [
  { scraperName: "alaska", popularRoute: { origin: "SFO", destination: "JFK" } },
  { scraperName: "united", popularRoute: { origin: "SFO", destination: "JFK" } },
]

// TODO: add partner test (ex SFO NRT on JAL via Alaska)

describe.each(scrapers)("%s scraper", ({ scraperName, popularRoute }) => {
  let browser: puppeteer.Browser
  let context: puppeteer.BrowserContext
  let page: puppeteer.Page

  beforeAll(async () => { browser = await puppeteer.connect({ browserWSEndpoint: "ws://localhost:4000" }) })
  beforeEach(async () => { context = await browser.createIncognitoBrowserContext(); page = await context.newPage() })
  afterEach(async () => { await page.close(); await context.close() })
  afterAll(async () => { await setTimeout(() => { browser.close() }, 1000) })

  it("can do a basic popular search", async () => {
    const scraperModule: typeof import("./alaska") = await import(`./${scraperName}`)
    const results = await scraperModule.scraper({ page, context: { origin: popularRoute.origin, destination: popularRoute.destination, departureDate: moment().add(2, "months").format("YYYY-MM-DD") } })

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
})
