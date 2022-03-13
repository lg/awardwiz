/* eslint-disable */

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { persistQueryClient } from "react-query/persistQueryClient-experimental"
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental"
import { ReactQueryDevtools } from "react-query/devtools"
import "./index.css"
import * as haversine from "haversine"

const queryClient = new ReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,         // when referenced and online, refresh data every 5min
      cacheTime: 1000 * 60 * 60 * 24,   // when unreferenced, drop after 24hrs
      retry: false
    }
  }
})

const localStoragePersistor = createWebStoragePersistor({ storage: window.localStorage })
persistQueryClient({ queryClient, persistor: localStoragePersistor })

// const airLabsFetch = (endpoint: string, signal?: AbortSignal) => {
//   return fetch(`https://airlabs.co/api/v9${endpoint}&api_key=${process.env.REACT_APP_AIRLABS_API_KEY}`, { signal })
//     .then((resp) => resp.json())
//     .then((resp) => {
//       if (resp.error)
//         throw new Error(`Error while making API call ${resp.error.message}`)
//       return resp.response
//     })
// }

type Airport = { country_code: string, iata_code: string, icao_code: string, lat: number, lng: number, name: string}
type AirportWithDistance = Airport & { distance: number }
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
