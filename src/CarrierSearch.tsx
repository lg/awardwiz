import * as React from "react"
import * as ReactQuery from "react-query"
import { airLabsFetch } from "./common"

const CarrierSearchResults = ({ origin, destination }: { origin: string, destination: string }) => {
  const { data: airlineNames } = ReactQuery.useQuery(["airlineNames"], ({ signal }) => {
    return fetch("/airlines.json", { signal }).then((resp) => resp.json()).then((arr: AirLabsAirlineName[]) => {
      return arr.reduce((result: {[key: string]: string}, item) => {
        result[item.iata_code] = item.name
        return result
      }, {})
    })
  })

  const { isLoading, error, data: departures } = ReactQuery.useQuery(["routes", origin, destination], ({ signal }) => {
    return airLabsFetch(`/routes?dep_iata=${origin}&arr_iata=${destination}`, signal)
      .then((schedules: AirLabsSchedule[]) => {
        const filtered = schedules.filter((schedule) => schedule.cs_flight_iata === null && schedule.airline_iata !== null)   // remove codeshares and private jets
        return filtered.reduce((result: AirlineRoute[], checkItem) => {
          if (!result.find((item) => item.airlineCode === checkItem.airline_iata) && checkItem.airline_iata) {
            const airlineName = airlineNames![checkItem.airline_iata]
            result.push({ origin, destination, airlineCode: checkItem.airline_iata!, airlineName })
          }
          return result
        }, [])
      })
  }, { enabled: !!airlineNames })

  if (isLoading)
    return <div>Loading...</div>
  if (error)
    return <div>An error occured: {(error as Error).message}</div>
  if (!departures)
    return <div>No results</div>

  return (
    <table>
      <tbody>
        {
          departures.map((departure) => (
            <tr key={`${departure.airlineCode}${departure.origin}${departure.destination}`}>
              <td>{departure.origin} ➤ {departure.destination}</td>
              <td>{departure.airlineCode}</td>
              <td>{departure.airlineName}</td>
            </tr>
          ))
        }
      </tbody>
    </table>
  )
}

export default class CarrierSearch extends React.Component<unknown, { origin: string, destination: string }> {
  state = { origin: "LIH", destination: "SFO" }

  private originInput: React.RefObject<HTMLInputElement> = React.createRef()
  private destinationInput: React.RefObject<HTMLInputElement> = React.createRef()

  render() {
    return (
      <div>
        <form onSubmit={(e) => {
          e.preventDefault()
          this.setState({
            origin: this.originInput.current!.value.toUpperCase(),
            destination: this.destinationInput.current!.value.toUpperCase()
          })
        }}>
          Carrier search&nbsp;
          <label>
            origin:
            <input type="text" defaultValue={this.state.origin} ref={this.originInput} />
          </label>
          <label>
            destination:
            <input type="text" defaultValue={this.state.destination} ref={this.destinationInput} />
          </label>
          <input type="submit" value="Lookup" />
        </form>
        <CarrierSearchResults origin={this.state.origin} destination={this.state.destination} />
      </div>
    )
  }
}
