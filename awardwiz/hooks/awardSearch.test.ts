import { expect, describe, it, afterEach } from "vitest"
import { ScrapersConfig, doesScraperSupportAirline, expandOriginsDestinations, fr24ResponseToAirlineRoutes, scrapersByAirlineRoutes } from "./awardSearch.js"
import scrapersConfigOrig from "../../config.json"
import { FlightRadar24Response } from "../types/fr24.js"
import decompress from "decompress"
const scrapersConfig = scrapersConfigOrig as ScrapersConfig
const scrapersConfigBackup = { ...scrapersConfig }

const fixtures = await decompress("./awardwiz-scrapers/scrapers/_fixtures.zip")

describe("expandOriginsDestinations", () => {
  it("shouldnt expand anything if there's only one origin and destination", () => {
    const searchQuery = { origins: ["SFO"], destinations: ["LAX"], departureDate: "2023-12-25" }
    const result = expandOriginsDestinations(searchQuery)
    expect(result).toEqual([
      { origin: "SFO", destination: "LAX", departureDate: "2023-12-25" }
    ])
  })

  it("should expand all permutations of origin and destination", () => {
    const searchQuery = { origins: ["SFO", "LAX"], destinations: ["JFK", "EWR"], departureDate: "2023-12-25" }
    const result = expandOriginsDestinations(searchQuery)
    expect(result).toEqual([
      { origin: "SFO", destination: "JFK", departureDate: "2023-12-25" },
      { origin: "SFO", destination: "EWR", departureDate: "2023-12-25" },
      { origin: "LAX", destination: "JFK", departureDate: "2023-12-25" },
      { origin: "LAX", destination: "EWR", departureDate: "2023-12-25" }
    ])
  })
})

describe("fr24ResponseToAirlineRoutes", () => {
  const loadFixture = (path: string) => {
    const data = fixtures.find(f => f.path === path)?.data.toString("utf-8")
    return { result: JSON.parse(data!) as FlightRadar24Response, logLines: [] }
  }

  afterEach(() => {
    scrapersConfig.excludeAirlines = [ ...scrapersConfigBackup.excludeAirlines ?? [] ]
  })

  it("should parse a regular response and remove dupes", () => {
    const sfoLih = loadFixture("fr24/sfo-lih.json")
    expect(fr24ResponseToAirlineRoutes(sfoLih)).toEqual([{
      origin: "SFO", destination: "LIH", airlineCode: "UA", airlineName: "United Airlines"
    }])
  })

  it("should skip airlines that are excluded", () => {
    const sfoLih = loadFixture("fr24/sfo-lih.json")
    scrapersConfig.excludeAirlines = ["UA"]
    expect(fr24ResponseToAirlineRoutes(sfoLih)).toEqual([])
  })

  it("should remove empty airlines names/codes", () => {
    const sfoLih = loadFixture("fr24/missing-airline-info.json")
    expect(fr24ResponseToAirlineRoutes(sfoLih)).toEqual([])
  })

  it("should parse an invalid query", () => {
    const invalid = loadFixture("fr24/invalid.json")
    expect(fr24ResponseToAirlineRoutes(invalid)).toEqual([])
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
    expect(result.map(r => r.scraperName)).toEqual(["alaska", "aa"])
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
    expect(result.map(r => r.scraperName)).toEqual(["alaska", "skiplagged"])
    expect(result.find(r => r.scraperName === "skiplagged")?.forAirlines).toEqual(["AS"])
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
    expect(result.map(r => r.scraperName)).toEqual(["alaska", "aa", "skiplagged"])
    expect(result.find(r => r.scraperName === "aa")?.forAirlines).toEqual(["AS", "AA"])
  })

  it("searches for an airline in a group", () => {
    const airlineRoutes = [{ origin: "SFO", destination: "HNL", airlineCode: "UA", airlineName: "United Airlines" }]
    scrapersConfig.scrapers = [
      { name: "united", supportedAirlines: ["staralliance"] },
      { name: "delta", supportedAirlines: ["skyteam"] }
    ]
    const result = scrapersByAirlineRoutes(airlineRoutes, "2023-12-25")
    expect(result.map(r => r.scraperName)).toEqual(["united"])
  })
})

describe("doesScraperSupportAirline", () => {
  afterEach(() => {
    scrapersConfig.scrapers = { ...scrapersConfigBackup.scrapers }
  })

  it("should support a simple scraper lookup", () => {
    scrapersConfig.scrapers = [{ name: "united", supportedAirlines: ["UA", "AC"] }]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "UA", true)).toBe(true)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AC", true)).toBe(true)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AA", true)).toBe(false)
  })

  it("should support a group lookup", () => {
    scrapersConfig.scrapers = [{ name: "united", supportedAirlines: ["staralliance"] }]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "UA", true)).toBe(true)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "DL", true)).toBe(false)
  })

  it("should support skipping disabled scrapers", () => {
    scrapersConfig.scrapers = [
      { name: "united", supportedAirlines: ["staralliance"], disabled: true },
      { name: "delta", supportedAirlines: ["skyteam"] },
      { name: "skiplagged", supportedAirlines: [], cashOnlyFares: true, disabled: true },
    ]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "UA", true)).toBe(false)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "DL", true)).toBe(true)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "UA", true)).toBe(false)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[2]!, "AA", true)).toBe(false)
  })

  it("should support cash-only fares", () => {
    scrapersConfig.scrapers = [
      { name: "skiplagged1", supportedAirlines: [], cashOnlyFares: true, disabled: true },
      { name: "skiplagged2", supportedAirlines: [], cashOnlyFares: true, disabled: false },
    ]
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AA", true)).toBe(false)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "AA", true)).toBe(true)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[0]!, "AA", false)).toBe(false)
    expect(doesScraperSupportAirline(scrapersConfig.scrapers[1]!, "AA", false)).toBe(false)
  })
})
