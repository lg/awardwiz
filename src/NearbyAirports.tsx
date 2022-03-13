import * as React from "react"
import * as ReactQuery from "react-query"
import * as haversine from "haversine"
import { Input, Card } from "antd"

const { Search } = Input

const NearbyAirportsResults = ({ code }: { code: string }) => {
  const { isLoading, error, data: nearbyAirports } = ReactQuery.useQuery(["nearbyAirports", code], ({ signal }) => {
    return fetch("/airports.json", { signal }).then((resp) => resp.json())
      .then((resp: Airport[]) => {
        const airport = resp.find((checkAirport) => checkAirport.iata_code === code)
        if (!airport) return []

        return resp.reduce((result: AirportWithDistance[], checkAirport) => {
          const distance = haversine({ latitude: airport.lat, longitude: airport.lng }, { latitude: checkAirport.lat, longitude: checkAirport.lng })
          if (distance < 50)
            result.push({ distance, ...checkAirport })
          return result
        }, [])
      })
  })

  if (isLoading)
    return <div>Loading...</div>
  if (error)
    return <div>An error occured: {(error as Error).message}</div>
  if (!nearbyAirports)
    return <div>No results</div>

  return (
    <ol>
      {nearbyAirports.sort((a, b) => a.distance - b.distance).map((airport) => (
        <li key={airport.iata_code}>{airport.name} - {airport.iata_code} - {Math.floor(airport.distance)}km</li>
      ))}
    </ol>
  )
}

export default class NearbyAirports extends React.Component<unknown, { airportCode: string }> {
  state = { airportCode: "SFO" }

  render() {
    return (
      <Card style={{ width: 500 }} size="small" title={(
        <Search addonBefore="Nearby airport search" defaultValue={this.state.airportCode} enterButton onSearch={(value) => {
          this.setState({ airportCode: value.toUpperCase() })
        }} />
      )}>
        <NearbyAirportsResults code={this.state.airportCode} />
      </Card>
    )
  }
}
