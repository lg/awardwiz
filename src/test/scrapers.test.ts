/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { expect, test } from "vitest"
import { FlightFare, FlightWithFares } from "../types/scrapers"
import { default as dayjs } from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { runScraper } from "../helpers/runScraper"

dayjs.extend(utc)
dayjs.extend(timezone)

type Route = [orig: string, dest: string]
type RouteWithExpectedFlight = [...route: Route, expectedFlight: string]
type ScraperConfig = [string, {
  popularRoute: Route,     // expect at least one result
  partnerRoute?: RouteWithExpectedFlight,    // expect a search to come up with partner availability
  plusOneDayRoute: Route   // expect a flight to land the day after it takes off
  missingAttribs?: (keyof FlightWithFares)[]    // if we know a scraper is missing a certain field
  missingFareAttribs?: (keyof FlightFare)[]     // if we know a scraper is missing a certain fare field
  zeroMilesOk?: boolean    // use this for cash-only scrapers
  longtermSearchEmptyOk?: boolean // use this to not expect any results for the 10 month check (exceptions still will fail the scraper)
  sameDayTz?: string       // use this to specify a timezone for the same day check, otherwise will be America/Los_Angeles
}][]

const scrapers: ScraperConfig = import.meta.env.VITE_LIVE_SCRAPER_TESTS ? [
  ["aa", { popularRoute: ["SFO", "LAX"], partnerRoute: ["HND", "FUK", "JL 303"], plusOneDayRoute: ["SFO", "JFK"] }],
  // ["aeroplan", { popularRoute: ["YOW", "YYZ"], partnerRoute: ["FRA", "MUC", "LH 108"], plusOneDayRoute: ["SFO", "EWR"], sameDayTz: "America/New_York" }],
  // ["alaska", { popularRoute: ["SFO", "JFK"], partnerRoute: ["SFO", "DUB", "EI 60"], plusOneDayRoute: ["HNL", "SFO"], missingFareAttribs: ["bookingClass"], missingAttribs: ["aircraft"] }],
  // ["delta", { popularRoute: ["SFO", "JFK"], partnerRoute: ["LIH", "OGG", "HA 140"], plusOneDayRoute: ["LAX", "JFK"] }],
  // ["jetblue", { popularRoute: ["SFO", "JFK"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "JFK"], sameDayTz: "America/New_York" }],
  // ["southwest", { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"], longtermSearchEmptyOk: true }],
  ["skiplagged", { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"], zeroMilesOk: true, missingAttribs: ["aircraft"], missingFareAttribs: ["bookingClass"] }],
  // ["skyscanner", { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"], zeroMilesOk: true, missingAttribs: ["aircraft"], missingFareAttribs: ["bookingClass"] }],
  ["united", { popularRoute: ["SFO", "EWR"], partnerRoute: ["NRT", "CGK", "NH 835"], plusOneDayRoute: ["SFO", "EWR"], sameDayTz: "America/New_York" }],
] : []

type KeysEnum<T> = { [_ in keyof Required<T>]: true }

const runQuery = async (scraperName: string, route: string[], checkDate = dayjs().add(3, "months").format("YYYY-MM-DD")) => {
  const scraperResponse = await runScraper(scraperName, { origin: route[0], destination: route[1], departureDate: checkDate }, ["scraper_tests"], undefined).catch((e: Error) => {
    throw new Error(`Axios errored in calling scraper: ${e.message}`)
  })
  if (scraperResponse.data.errored)
    throw new Error(`Errored in scraper\n\n${scraperResponse.data.log.join("\n")}`)
  return scraperResponse.data
}

test("pass", () => {})

test.concurrent.each(scrapers)("basic search: %s", async (scraperName, scraper) => {
  const results = await runQuery(scraperName, scraper.popularRoute)

  expect(results.flightsWithFares.length).toBeGreaterThanOrEqual(1)
  expect(results.flightsWithFares.every((flight) => flight.fares.length > 0)).toBe(true)
  if (!scraper.zeroMilesOk) expect(results.flightsWithFares.every((flight) => flight.fares.every((fare) => fare.miles > 1000))).toBe(true)

  // Ensure that there there are no unexpected missing attributes
  const expectedFlightKeys: KeysEnum<FlightWithFares> = { flightNo: true, departureDateTime: true, arrivalDateTime: true, origin: true, destination: true, duration: true, fares: true, aircraft: true, amenities: true }
  for (const flight of results.flightsWithFares) {
    const rawFlight: Record<string, any> = flight
    const undefinedFlightKeys = Object.keys(expectedFlightKeys).filter((check) => rawFlight[check] === undefined && !(scraper.missingAttribs?.includes(check as keyof FlightWithFares)))
    expect(undefinedFlightKeys, `Expected flight \n\n${JSON.stringify(flight)}\n\n to not have any undefined keys`).toEqual([])

    const expectedFareKeys: KeysEnum<Omit<FlightFare, "isSaverFare">> = { cabin: true, miles: true, bookingClass: true, cash: true, currencyOfCash: true, scraper: true }
    for (const fare of flight.fares) {
      const rawFare: Record<string, any> = fare
      const undefinedFareKeys = Object.keys(expectedFareKeys).filter((check) => rawFare[check] === undefined && !(scraper.missingFareAttribs?.includes(check as keyof FlightFare)))
      expect(undefinedFareKeys, `Expected flight \n\n${JSON.stringify(flight)}\n\n and fare \n\n${JSON.stringify(fare)}\n\n to not have any undefined keys`).toEqual([])
    }
  }
}, { retry: 5 })

test.concurrent.each(scrapers)("basic same-day search: %s", async (scraperName, scraper) => {
  await runQuery(scraperName, scraper.popularRoute, dayjs().tz(scraper.sameDayTz ?? "America/Los_Angeles").format("YYYY-MM-DD"))
}, { retry: 5 })

test.concurrent.each(scrapers.filter(([scraperName, scraper]) => scraper.partnerRoute))("partner availability search: %s", async (scraperName, scraper) => {
  let checkDate = dayjs().add(3, "months").format("YYYY-MM-DD")
  let found = false
  do {
    // eslint-disable-next-line no-await-in-loop
    const results = await runQuery(scraperName, scraper.partnerRoute!, checkDate)
    const expectFlightNo = scraper.partnerRoute![2]
    found = results.flightsWithFares.some((flight) => flight.flightNo === expectFlightNo)

    checkDate = dayjs(checkDate).add(1, "days").format("YYYY-MM-DD")
  } while (dayjs(checkDate).isBefore(dayjs(checkDate).add(3, "days")) && !found)

  expect(found, `Could not find flight ${scraper.partnerRoute![2]} ${scraper.partnerRoute![0]}->${scraper.partnerRoute![1]} on ${checkDate} or the following two days`).toBe(true)
}, { retry: 5 })

test.concurrent.each(scrapers)("fails gracefully with unserved airports: %s", async (scraperName, scraper) => {
  const results = await runQuery(scraperName, ["SFO", "OGS"])
  expect(results.flightsWithFares.length).toBe(0)
}, { retry: 5 })

test.concurrent.each(scrapers)("can search 10 months from now: %s", async (scraperName, scraper) => {
  const futureDate = dayjs().add(10, "months").format("YYYY-MM-DD")
  const results = await runQuery(scraperName, scraper.popularRoute, futureDate)
  expect(results.flightsWithFares.length).toBeGreaterThanOrEqual(scraper.longtermSearchEmptyOk ? 0 : 1)
  for (const flight of results.flightsWithFares) {
    const receivedDate = dayjs(flight.departureDateTime).format("YYYY-MM-DD")
    expect(receivedDate, `Expected date from results (${receivedDate}) to be the same as we searched (${futureDate})`).equals(futureDate)
  }
}, { retry: 5 })

// more:
//   // it.todo("can distinguish a 3-class domestic vs 2-class domestic", async () => {})
//   // it.todo("can properly deal with day +1 arrival", async () => { }, 20000)
//   // it.todo("fails gracefully when no results", async () => { }, 20000)
//   // it.todo("properly classifies domestic 'first' as business", async () => { }, 20000)
//   // it.todo("properly classifies domestic 'first' as business unless lieflat", async () => { }, 20000)
//   // it.todo("properly classifies first flights", async () => { }, 20000)
//   // it.todo("properly classifies first flights with partners", async () => { }, 20000)
// })

export {}
