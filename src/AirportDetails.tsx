import * as React from "react"
import * as ReactQuery from "react-query"

const AirportDetailsResults = ({ code }: { code: string }) => {
  const { isLoading, error, data: airportDetails } = ReactQuery.useQuery(["airportDetails", code], ({ signal }) => {
    return fetch("/airports.json", { signal }).then((resp) => resp.json())
      .then((_resp: Airport[]) => {
        return { name: "hi" }
      })
  })

  if (isLoading)
    return <div>Loading...</div>
  if (error)
    return <div>An error occured: {(error as Error).message}</div>
  if (!airportDetails)
    return <div>No results</div>

  return (
    <div>Name: {airportDetails.name}</div>
  )
}

export default class AirportDetails extends React.Component<unknown, { airportCode: string }> {
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
            Airport details:
            <input type="text" defaultValue={this.state.airportCode} ref={this.airportCodeInput} />
          </label>
          <input type="submit" value="Lookup" />
        </form>
        <AirportDetailsResults code={this.state.airportCode} />
      </div>
    )
  }
}
