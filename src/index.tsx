/* eslint-disable */
import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { persistQueryClient } from "react-query/persistQueryClient-experimental"
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental"
import { ReactQueryDevtools } from "react-query/devtools"
import "./index.css"
import NearbyAirports from "./NearbyAirports"

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

interface AppState {}
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
