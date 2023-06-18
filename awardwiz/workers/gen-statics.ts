// This script downloads the latest airports and filters/formats them for use with AwardWiz.
// Use the Launch profile in VSCode to debug this if necessary.

import { Airport } from "../types/scrapers"
import { find as findTz } from "geo-tz"
import { writeFileSync } from "fs"
import fetch from "node-fetch"

const startTime = Date.now()

type FR24Airport = [icaoCode: string, iataCode: string, airportName: string, latitude: number, longitude: number, website: string | undefined, popularity: number, city: string, country: string]
type FR24Airports = Record<string, FR24Airport>
const fr24Airports = await fetch("https://www.flightradar24.com/airports/list").then((airportsRes) => airportsRes.json()) as FR24Airports

const airports = Object.values(fr24Airports).map((fr24Airport): Airport | undefined => {
  return fr24Airport[1] && fr24Airport[1].length === 3 && fr24Airport[2] ? {
    iataCode: fr24Airport[1],
    name: fr24Airport[2],
    popularity: fr24Airport[6],
    tzName: findTz(fr24Airport[3], fr24Airport[4])[0]
  } : undefined
}).filter((airport): airport is Airport => !!airport).sort((a, b) => a.popularity > b.popularity ? -1 : 1)

writeFileSync("airports.json", JSON.stringify(airports, undefined, 2))
console.log(`Wrote airports database to airports.json in ${(Date.now() - startTime) / 1000}s`)
