/* eslint-disable */

// TODO: remove the as-you-type stuff and make the button work
// TODO: cache long/lat of airports from other results
// TODO: dont save a failed request
// TODO: check that a lookup of a non-existant airport doesnt blow things up

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { useQuery } from "react-query"
import { persistQueryClient } from 'react-query/persistQueryClient-experimental'
import { createWebStoragePersistor } from 'react-query/createWebStoragePersistor-experimental'
import "./index.css"

const queryClient = new ReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 60 * 1000,
      cacheTime: 1000 * 60 * 60 * 24
    }
  }
})

const localStoragePersistor = createWebStoragePersistor({storage: window.localStorage})
persistQueryClient({ queryClient, persistor: localStoragePersistor })

const NearbyAirportsResults = ({ code }: { code: string }) => {
  const { data: airportLongLats } = useQuery(["airportLongLats", code], ({ signal }) => {
    return fetch(`https://airlabs.co/api/v9/airports?iata_code=${code}&api_key=${process.env.REACT_APP_AIRLABS_API_KEY}`, { signal })
    .then((resp) => resp.json())
  })

  const { data: nearbyAirports, isIdle, isLoading, error } = useQuery(["nearbyAirports", [airportLongLats?.response[0].lng, airportLongLats?.response[0].lat]], ({ signal }) => {
    return fetch(`https://airlabs.co/api/v9/nearby?lat=${airportLongLats.response[0].lat}&lng=${airportLongLats.response[0].lng}&distance=50&api_key=${process.env.REACT_APP_AIRLABS_API_KEY}`, { signal })
    .then((resp) => resp.json())
    .then((result) => result.response.airports)
  }, { enabled: !!airportLongLats })

  if (isLoading || isIdle)
    return <div>Loading...</div>
  if (error)
    return <div>An error occured: {(error as Error).message}</div>

  return (
    <ol>
      {nearbyAirports.map((airport: {name: string, iata_code: string, distance: number}) => (
        <li key={airport.iata_code}>{airport.name} - {airport.iata_code} - {Math.floor(airport.distance)}km</li>
      ))}
    </ol>
  )
}

class NearbyAirports extends React.Component<{}, { airportCode: string }> {
  state = { airportCode: "SFO" }

  render() {
    return (
      <div>
        <form onSubmit={(e) => {
          e.preventDefault()
          // eslint-disable-next-line
          window.alert(this.state.airportCode)
        }}>
          <label>
            Airport:
            <input
              type="text"
              value={this.state.airportCode}
              onChange={(e) => this.setState({ airportCode: e.target.value })}
            />
          </label>
          <input type="submit" value="Lookup" />
        </form>
        <NearbyAirportsResults code={this.state.airportCode} />
      </div>
    )
  }
}

interface AppState {
}
class App extends React.Component<{}, AppState> {
  state: AppState = {}

  render() {
    return (
      <ReactQuery.QueryClientProvider client={queryClient}>
        <NearbyAirports />
      </ReactQuery.QueryClientProvider>
    )
  }
}

// ========================================

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
)
