import { expect, describe, it, afterEach, vi } from "vitest"
import { DatedRoute, ScrapersConfig, doesScraperSupportAirline, expandOriginsDestinations, findAwardFlights, fr24ResponseToAirlineRoutes, scrapersByAirlineRoutes } from "../../awardwiz/hooks/awardSearch.js"
import scrapersConfigOrig from "../../config.json"
import { FlightRadar24Response } from "../../awardwiz/types/fr24.js"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { FlightWithFares, ScraperResponse } from "../../awardwiz/types/scrapers.js"
const scrapersConfig = scrapersConfigOrig as ScrapersConfig
const scrapersConfigBackup = { ...scrapersConfig }

const readScraperResponseStub = <T>(path: string) => {
  if (!existsSync(`./test/awardwiz/stubs/${path}`))
    return undefined
  const data = readFileSync(`./test/awardwiz/stubs/${path}`)
  return JSON.parse(data.toString("utf-8")) as ScraperResponse<T>
}

const writeScraperResponseStub = (path: string, data: string) =>
  writeFileSync(`./test/awardwiz/stubs/_${path}`, data)

vi.mock("../../awardwiz/helpers/runScraper.js", (importOriginal) => ({
  runScraper: async (scraperName: string, datedRoute: DatedRoute) => {
    const filename = `${scraperName}-${datedRoute.origin.toLowerCase()}-${datedRoute.destination.toLowerCase()}.json`
    const scraperResponse = readScraperResponseStub<FlightWithFares[]>(filename)
    if (scraperResponse)
      return Promise.resolve(scraperResponse)

    if (import.meta.env["WRITE_MISSING_STUBS"] === "true") {
      const rs: typeof import("../../awardwiz/helpers/runScraper.js") = await importOriginal()
      const response = await rs.runScraper(scraperName, datedRoute, undefined)
      writeScraperResponseStub(filename, JSON.stringify(response))
      return Promise.resolve(response)
    }

    throw new Error(`Missing stub for ${filename}`)
  }
}))

describe("expandOriginsDestinations", () => {
  it("shouldnt expand anything if there's only one origin and destination", () => {
    const searchQuery = { origins: ["SFO"], destinations: ["LAX"], departureDate: "2023-12-25" }
    const result = expandOriginsDestinations(searchQuery)
    expect(result).toStrictEqual([
      { origin: "SFO", destination: "LAX", departureDate: "2023-12-25" }
    ])
  })

  it("should expand all permutations of origin and destination", () => {
    const searchQuery = { origins: ["SFO", "LAX"], destinations: ["JFK", "EWR"], departureDate: "2023-12-25" }
    const result = expandOriginsDestinations(searchQuery)
    expect(result).toStrictEqual([
      { origin: "SFO", destination: "JFK", departureDate: "2023-12-25" },
      { origin: "SFO", destination: "EWR", departureDate: "2023-12-25" },
      { origin: "LAX", destination: "JFK", departureDate: "2023-12-25" },
      { origin: "LAX", destination: "EWR", departureDate: "2023-12-25" }
    ])
  })
})

describe("fr24ResponseToAirlineRoutes", () => {
  afterEach(() => {
    scrapersConfig.excludeAirlines = [ ...scrapersConfigBackup.excludeAirlines ?? [] ]
  })

  it("should parse a regular response and remove dupes", () => {
    const sfoLih = readScraperResponseStub<FlightRadar24Response>("fr24-sfo-lih.json")
    expect(fr24ResponseToAirlineRoutes(sfoLih!)).toStrictEqual([{
      origin: "SFO", destination: "LIH", airlineCode: "UA", airlineName: "United Airlines"
    }])
  })

  it("should skip airlines that are excluded", () => {
    const sfoLih = readScraperResponseStub<FlightRadar24Response>("fr24-sfo-lih.json")
    scrapersConfig.excludeAirlines = ["UA"]
    expect(fr24ResponseToAirlineRoutes(sfoLih!)).toStrictEqual([])
  })

  it("should remove empty airlines names/codes", () => {
    const missingAirlineInfo = readScraperResponseStub<FlightRadar24Response>("fr24-missing-airline-info.json")
    expect(fr24ResponseToAirlineRoutes(missingAirlineInfo!)).toStrictEqual([])
  })

  it("should parse an invalid query", () => {
    const invalid = readScraperResponseStub<FlightRadar24Response>("fr24-invalid.json")
    expect(fr24ResponseToAirlineRoutes(invalid!)).toStrictEqual([])
  })
})

describe("scrapersByAirlineRoutes", () => {
  afterEach(() => {
    scrapersConfig.scrapers = { ...scrapersConfigBackup.scrapers }
  })

  it("properly selects own scraper and a partner scraper", () => {
    const airlineRoutes = [{ origin: "SFO", destination: "HNL", airlineCode: "AS", airlineName: "Alaska Airlines" }]
    scrapersConfig.scrapers = [
      { name: "alaska", supportedAirlines: ["AS"] },
      { name: "aa", supportedAirlines: ["AA", "AS"] }
    ]
    const result = scrapersByAirlineRoutes(airlineRoutes, "2023-12-25")
    expect(result.map(r => r.scraperName)).toStrictEqual(["alaska", "aa"])
  })

  it("properly selects a cash-only scraper", () => {
    const airlineRoutes = [
      { origin: "SFO", destination: "HNL", airlineCode: "AS", airlineName: "Alaska Airlines" }
    ]
    scrapersConfig.scrapers = [
      { name: "alaska", supportedAirlines: ["AS"] },
      { name: "skiplagged", supportedAirlines: [], cashOnlyFares: true },
      { name: "united", supportedAirlines: ["UA"] },
    ]
    const result = scrapersByAirlineRoutes(airlineRoutes, "2023-12-25")
    expect(result.map(r => r.scraperName)).toStrictEqual(["alaska", "skiplagged"])
    expect(result.find(r => r.scraperName === "skiplagged")?.forAirlines).toStrictEqual(["AS"])
  })

  it("uses one compatible scraper for two requests", () => {
    const airlineRoutes = [
      { origin: "SFO", destination: "HNL", airlineCode: "AS", airlineName: "Alaska Airlines" },
      { origin: "SFO", destination: "HNL", airlineCode: "AA", airlineName: "American Airlines" }
    ]
    scrapersConfig.scrapers = [
      { name: "alaska", supportedAirlines: ["AS"] },
      { name: "aa", supportedAirlines: ["AA", "AS", "BA"] },
      { name: "united", supportedAirlines: ["AC", "UA"] },
      { name: "skiplagged", supportedAirlines: [], cashOnlyFares: true },
    ]

    const result = scrapersByAirlineRoutes(airlineRoutes, "2023-12-25")
    expect(result.map(r => r.scraperName)).toStrictEqual(["alaska", "aa", "skiplagged"])
    expect(result.find(r => r.scraperName === "aa")?.forAirlines).toStrictEqual(["AS", "AA"])
  })

  it("searches for an airline in a group", () => {
    const airlineRoutes = [{ origin: "SFO", destination: "HNL", airlineCode: "UA", airlineName: "United Airlines" }]
    scrapersConfig.scrapers = [
      { name: "united", supportedAirlines: ["staralliance"] },
      { name: "delta", supportedAirlines: ["skyteam"] }
    ]
    const result = scrapersByAirlineRoutes(airlineRoutes, "2023-12-25")
    expect(result.map(r => r.scraperName)).toStrictEqual(["united"])
  })
})

describe("doesScraperSupportAirline", () => {
  afterEach(() => {
    scrapersConfig.scrapers = [ ...scrapersConfigBackup.scrapers ]
  })

  it("should support a simple scraper lookup", () => {
    scrapersConfig.scrapers = [{ name: "united", supportedAirlines: ["UA", "AC"] }]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "UA", true)).toBeTruthy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AC", true)).toBeTruthy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AA", true)).toBeFalsy()
  })

  it("should support a group lookup", () => {
    scrapersConfig.scrapers = [{ name: "united", supportedAirlines: ["staralliance"] }]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "UA", true)).toBeTruthy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "DL", true)).toBeFalsy()
  })

  it("should support skipping disabled scrapers", () => {
    scrapersConfig.scrapers = [
      { name: "united", supportedAirlines: ["staralliance"], disabled: true },
      { name: "delta", supportedAirlines: ["skyteam"] },
      { name: "skiplagged", supportedAirlines: [], cashOnlyFares: true, disabled: true },
    ]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "UA", true)).toBeFalsy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "DL", true)).toBeTruthy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "UA", true)).toBeFalsy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[2]!, "AA", true)).toBeFalsy()
  })

  it("should support cash-only fares", () => {
    scrapersConfig.scrapers = [
      { name: "skiplagged1", supportedAirlines: [], cashOnlyFares: true, disabled: true },
      { name: "skiplagged2", supportedAirlines: [], cashOnlyFares: true, disabled: false },
    ]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AA", true)).toBeFalsy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "AA", true)).toBeTruthy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AA", false)).toBeFalsy()
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "AA", false)).toBeFalsy()
  })
})

describe("findAwardFlights", () => {
  it("should support a simple search", async () => {
    const flights = await findAwardFlights({origins: ["SFO", "OAK"], destinations: ["HNL"], departureDate: "2023-12-25"})
    expect(flights).toMatchSnapshot()
  })
}, { timeout: 30000 })
