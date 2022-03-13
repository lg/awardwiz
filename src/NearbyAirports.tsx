import * as React from "react"
import * as ReactQuery from "react-query"
import * as haversine from "haversine"

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
  }, { staleTime: Infinity })

  if (isLoading)
    return <div>Loading...</div>
  if (error)
    return <div>An error occured: {(error as Error).message}</div>
  if (!nearbyAirports)
    return <div>No results</div>

  return (
    <ol>
      {nearbyAirports.map((airport) => (
        <li key={airport.iata_code}>{airport.name} - {airport.iata_code} - {Math.floor(airport.distance)}km</li>
      ))}
    </ol>
  )
}

export default class NearbyAirports extends React.Component<unknown, { airportCode: string }> {
  state = { airportCode: "SFO" }

  private airportCodeInput: React.RefObject<HTMLInputElement> = React.createRef()

  render() {
    return (
      <div>
        <form onSubmit={(e) => {
          e.preventDefault()
          this.setState({ airportCode: this.airportCodeInput.current!.value.toUpperCase() })
        }}>
          <label>
            Nearby airport:
            <input type="text" defaultValue={this.state.airportCode} ref={this.airportCodeInput} />
          </label>
          <input type="submit" value="Lookup" />
        </form>
        <NearbyAirportsResults code={this.state.airportCode} />
      </div>
    )
  }
}
