/* eslint-disable */
import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { persistQueryClient } from "react-query/persistQueryClient-experimental"
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental"
import { ReactQueryDevtools } from "react-query/devtools"
import "./index.css"
import NearbyAirports from "./NearbyAirports"
import RouteSearch from "./RouteSearch"

const queryClient = new ReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 12,   // when referenced and online, refresh data every 12hrs
      cacheTime: 1000 * 60 * 60 * 24,   // when unreferenced, drop after 24hrs
      retry: false
    }
  }
})

const localStoragePersistor = createWebStoragePersistor({ storage: window.localStorage })
persistQueryClient({ queryClient, persistor: localStoragePersistor })

interface AppState {}
class App extends React.Component<{}, AppState> {
  state: AppState = {}

  render() {
    return (
      <ReactQuery.QueryClientProvider client={queryClient}>
        <NearbyAirports />
        <RouteSearch />
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
