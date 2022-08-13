import { DefaultOptionType } from "antd/lib/select"
import * as React from "react"
import airportsDb from "../airports.json"
import type { Airport } from "../types/scrapers"

export const useAirportsDb = () => {
  return React.useMemo(() => {
    const airportOptions: Record<string, DefaultOptionType> = {}   // faster for deduplication
    const airports: Record<string, Airport> = {}
    airportsDb.forEach((airport: Airport) => {
      if (airport.iata_code && airport.name && airport.iata_code.length === 3) {
        airportOptions[airport.iata_code] = { value: airport.iata_code, label: `${airport.iata_code} - ${airport.name}` }
        airports[airport.iata_code] = airport
      }
    })

    return { options: Object.values(airportOptions), airports }
  }, [])
}
