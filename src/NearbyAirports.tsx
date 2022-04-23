import * as React from "react"
import * as ReactQuery from "react-query"
import * as haversine from "haversine"
import { Input, Card, Alert } from "antd"
import { Airport, AirportWithDistance } from "./types/types"

const { Search } = Input

export const NearbyAirports = () => {
  const [airportCode, setAirportCode] = React.useState("SFO")

  const { isLoading, error, data: nearbyAirports } = ReactQuery.useQuery(["nearbyAirports", airportCode], ({ signal }) => {
    return fetch("/airports.json", { signal }).then((resp) => resp.json())
      .then((resp: Airport[]) => {
        const airport = resp.find((checkAirport) => checkAirport.iata_code === airportCode)
        if (!airport) return []

        return resp.reduce((result: AirportWithDistance[], checkAirport) => {
          const distance = haversine({ latitude: airport.latitude, longitude: airport.longitude }, { latitude: checkAirport.latitude, longitude: checkAirport.longitude })
          if (distance < 50)
            if (checkAirport.iata_code)  // ensure this is a valid iata airport
              result.push({ distance, ...checkAirport })
          return result
        }, [])
      })
  })

  let results = null
  if (nearbyAirports && nearbyAirports.length > 0) {
    results = (
      <ol>
        {nearbyAirports.sort((a, b) => a.distance - b.distance).map((airport) => (
          <li key={airport.iata_code}>{airport.name} - {airport.iata_code} - {Math.floor(airport.distance)}km</li>
        ))}
      </ol>
    )
  } else if (error) {
    results = <Alert message={`An error occured: ${(error as Error).message}`} type="error" />
  } else if (nearbyAirports && nearbyAirports.length === 0) {
    results = <Alert message={`Airport ${airportCode} not found`} type="info" />
  }

  return (
    <Card style={{ width: 500 }} size="small" title={(
      <Search addonBefore="Nearby airport search" defaultValue={airportCode} enterButton loading={isLoading} onSearch={(value) => {
        setAirportCode(value.toUpperCase())
      }} />
    )}>
      { results }
    </Card>
  )
}
