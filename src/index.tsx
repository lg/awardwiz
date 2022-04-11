import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { persistQueryClient } from "react-query/persistQueryClient-experimental"
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental"
import "./index.css"
import { NearbyAirports } from "./NearbyAirports"
import { CarrierSearch } from "./CarrierSearch"

const queryClient = new ReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 12,   // when referenced and online, refresh data every 12hrs
      cacheTime: 1000 * 60 * 60 * 24,   // when unreferenced, drop after 24hrs
      retry: false
    }
  }
})

if (process.env.CACHE_OFF !== "true") {
const localStoragePersistor = createWebStoragePersistor({ storage: window.localStorage })
persistQueryClient({ queryClient, persistor: localStoragePersistor })
}

class App extends React.Component {
  render() {
    return (
      <ReactQuery.QueryClientProvider client={queryClient}>
        <NearbyAirports />
        <CarrierSearch />
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
