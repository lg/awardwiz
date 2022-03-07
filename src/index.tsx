/* eslint-disable */

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { persistQueryClient } from 'react-query/persistQueryClient-experimental'
import { createWebStoragePersistor } from 'react-query/createWebStoragePersistor-experimental'
import { ReactQueryDevtools } from 'react-query/devtools'
import "./index.css"

const queryClient = new ReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,         // refresh data every 5min
      cacheTime: 1000 * 60 * 60 * 24,   // when unreferenced, drop after 24hrs
      retry: false
    }
  }
})

const localStoragePersistor = createWebStoragePersistor({storage: window.localStorage})
persistQueryClient({ queryClient, persistor: localStoragePersistor })

const airLabsFetch = (endpoint: string, signal?: AbortSignal) => {
  return fetch(`https://airlabs.co/api/v9${endpoint}&api_key=${process.env.REACT_APP_AIRLABS_API_KEY}`, { signal })
    .then((resp) => resp.json())
    .then((resp) => {
      if (resp.error)
        throw new Error(`Error while making API call ${resp.error.message}`)
      return resp.response
    })
}

const NearbyAirportsResults = ({ code }: { code: string }) => {
  const { isLoading, error, data: nearbyAirports } = ReactQuery.useQuery(["nearbyAirports", code], ({ signal }) => {
    return fetch("/airports.json", { signal })
      .then(async (resp) => {
        const airports = await resp.json()
        const localAirport = airports.find((item: any) => item.iata_code === code)
        return localAirport ? [localAirport] : airLabsFetch(`/airports?iata_code=${code}`, signal)
      })
      .then((airport) => airport[0] ? airLabsFetch(`/nearby?lat=${airport[0].lat}&lng=${airport[0].lng}&distance=50`, signal) : {response: {airports: []}})
      .then((response) => response.airports)
  }, { staleTime: Infinity })

  if (isLoading)
    return <div>Loading...</div>
  if (error)
    return <div>An error occured: {(error as Error).message}</div>
  if (!nearbyAirports)
    return <div>No results</div>

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
  private airportCodeInput: React.RefObject<HTMLInputElement> = React.createRef()

  render() {
    return (
      <div>
        <form onSubmit={(e) => {
          e.preventDefault()
          this.setState({airportCode: this.airportCodeInput.current!.value.toUpperCase()})
        }}>
          <label>
            Airport:
            <input type="text" defaultValue={this.state.airportCode} ref={this.airportCodeInput} />
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
        <ReactQueryDevtools initialIsOpen={false} />
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
