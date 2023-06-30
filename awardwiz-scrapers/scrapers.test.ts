import { expect, describe, it, beforeAll } from "vitest"
import { AwardWizScraperModule, DatedRoute, FlightFare, FlightWithFares } from "./awardwiz-types.js"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"
import { DebugOptions, runArkalis } from "../arkalis/arkalis.js"

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

const RETRIES = 0

const scrapers: ScraperConfig = [
  // ["aa", { popularRoute: ["SFO", "LAX"], partnerRoute: ["HND", "FUK", "JL 303"], plusOneDayRoute: ["SFO", "JFK"] }],
  // ["aeroplan", { popularRoute: ["YOW", "YYZ"], partnerRoute: ["FRA", "MUC", "LH 106"], plusOneDayRoute: ["SFO", "EWR"], sameDayTz: "America/New_York" }],
  // ["alaska", { popularRoute: ["SFO", "JFK"], partnerRoute: ["SFO", "DUB", "EI 60"], plusOneDayRoute: ["HNL", "SFO"], missingFareAttribs: ["bookingClass"], missingAttribs: ["aircraft"] }],
  // // ["delta", { popularRoute: ["SFO", "JFK"], partnerRoute: ["LIH", "OGG", "HA 140"], plusOneDayRoute: ["LAX", "JFK"], sameDayTz: "America/New_York" }],
  // ["jetblue", { popularRoute: ["SFO", "JFK"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "JFK"], sameDayTz: "America/New_York" }],
  // ["southwest", { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"], longtermSearchEmptyOk: true }],
  // ["skiplagged", { popularRoute: ["SFO", "LAX"], partnerRoute: undefined, plusOneDayRoute: ["SFO", "EWR"], zeroMilesOk: true, missingAttribs: ["aircraft"], missingFareAttribs: ["bookingClass"] }],
  // ["united", { popularRoute: ["SFO", "EWR"], partnerRoute: ["FRA", "MUC", "LH 106"], plusOneDayRoute: ["SFO", "EWR"], sameDayTz: "America/New_York" }],
]

type KeysEnum<T> = { [_ in keyof Required<T>]: true }

const runQuery = async (scraperName: string, route: string[], checkDate = dayjs().add(3, "months").format("YYYY-MM-DD")) => {
  const scraper = await import(`./scrapers/${scraperName}.ts`) as AwardWizScraperModule
  const datedRoute: DatedRoute = { origin: route[0]!, destination: route[1]!, departureDate: checkDate }
  const options: DebugOptions = { maxAttempts: 1, showRequests: false, liveLog: null, }
  const identifier = `debug-${scraper.meta.name}-${datedRoute.origin}${datedRoute.destination}-${datedRoute.departureDate.substring(5, 7)}${datedRoute.departureDate.substring(8, 10)}`

  return runArkalis(async (arkalis) => {
    arkalis.log("Using query:", datedRoute)
    return scraper.runScraper(arkalis, datedRoute)
  }, options, scraper.meta, identifier).then((response) => {
    if (response.result === undefined)
      throw new Error(`Scraper failed (${identifier}):\n\n${response.logLines.join("\n")}`)
    return response
  })
}

describe("awardwiz scrapers", () => {
  beforeAll(() => {
    dayjs.extend(utc)
    dayjs.extend(timezone)
  })

  it.concurrent.each(scrapers)("basic search: %s", async (scraperName, scraper) => {
    const results = await runQuery(scraperName, scraper.popularRoute)
    expect(results.result!.length).toBeGreaterThanOrEqual(1)
    expect(results.result!.every((flight) => flight.fares.length > 0)).toBeTruthy()
    if (!scraper.zeroMilesOk)
      expect(results.result!.every((flight) => flight.fares.every((fare) => fare.miles > 1000))).toBeTruthy()

    // Ensure that there there are no unexpected missing attributes
    const expectedFlightKeys: KeysEnum<FlightWithFares> = { flightNo: true, departureDateTime: true, arrivalDateTime: true, origin: true, destination: true, duration: true, fares: true, aircraft: true, amenities: true }
    for (const flight of results.result!) {
      const rawFlight: Record<string, any> = flight
      const undefinedFlightKeys = Object.keys(expectedFlightKeys).filter((check) => rawFlight[check] === undefined && !(scraper.missingAttribs?.includes(check as keyof FlightWithFares)))
      expect(undefinedFlightKeys, `Expected flight \n\n${JSON.stringify(flight)}\n\n to not have any undefined keys`).toStrictEqual([])

      const expectedFareKeys: KeysEnum<Omit<FlightFare, "isSaverFare">> = { cabin: true, miles: true, bookingClass: true, cash: true, currencyOfCash: true, scraper: true }
      for (const fare of flight.fares) {
        const rawFare: Record<string, any> = fare
        const undefinedFareKeys = Object.keys(expectedFareKeys).filter((check) => rawFare[check] === undefined && !(scraper.missingFareAttribs?.includes(check as keyof FlightFare)))
        expect(undefinedFareKeys, `Expected flight \n\n${JSON.stringify(flight)}\n\n and fare \n\n${JSON.stringify(fare)}\n\n to not have any undefined keys`).toStrictEqual([])
      }
    }
  }, { retry: RETRIES })

  it.concurrent.each(scrapers)("basic same-day search: %s", async (scraperName, scraper) => {
    await runQuery(scraperName, scraper.popularRoute, dayjs().tz(scraper.sameDayTz ?? "America/Los_Angeles").format("YYYY-MM-DD"))
  }, { retry: RETRIES })

  it.concurrent.each(scrapers)("fails gracefully with a past-day search: %s", async (scraperName, scraper) => {
    const results = await runQuery(scraperName, scraper.popularRoute, dayjs().subtract(2, "days").format("YYYY-MM-DD"))
    expect(results.result, "Expected no results when doing a past-day search").toHaveLength(0)
  }, { retry: RETRIES })

  it.concurrent.each(scrapers.filter(([scraperName, scraper]) => scraper.partnerRoute))("partner availability search: %s", async (scraperName, scraper) => {
    let checkDate = dayjs().add(3, "months").format("YYYY-MM-DD")
    let found = false
    do {
      // eslint-disable-next-line no-await-in-loop
      const results = await runQuery(scraperName, scraper.partnerRoute!, checkDate)
      const expectFlightNo = scraper.partnerRoute![2]

      found = results.result!.some((flight) => flight.flightNo === expectFlightNo)

      checkDate = dayjs(checkDate).add(1, "days").format("YYYY-MM-DD")
    } while (dayjs(checkDate).isBefore(dayjs(checkDate).add(3, "days")) && !found)

    expect(found, `Could not find flight ${scraper.partnerRoute![2]} ${scraper.partnerRoute![0]}->${scraper.partnerRoute![1]} on ${checkDate} or the following two days`).toBeTruthy()
  }, { retry: RETRIES })

  it.concurrent.each(scrapers)("fails gracefully with unserved airports: %s", async (scraperName, scraper) => {
    const results = await runQuery(scraperName, ["SFO", "OGS"])
    expect(results.result).toHaveLength(0)
  }, { retry: RETRIES })

  it.concurrent.each(scrapers)("can search 10 months from now: %s", async (scraperName, scraper) => {
    const futureDate = dayjs().add(10, "months").format("YYYY-MM-DD")
    const results = await runQuery(scraperName, scraper.popularRoute, futureDate)
    expect(results.result!.length).toBeGreaterThanOrEqual(scraper.longtermSearchEmptyOk ? 0 : 1)
    for (const flight of results.result!) {
      const receivedDate = dayjs(flight.departureDateTime).format("YYYY-MM-DD")
      expect(receivedDate, `Expected date from results (${receivedDate}) to be the same as we searched (${futureDate})`).equals(futureDate)
    }
  }, { retry: RETRIES })
})

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
