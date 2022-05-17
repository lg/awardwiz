import React from "react"
import ReactDOM from "react-dom/client"
import * as ReactQuery from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"
import { persistQueryClient } from "react-query/persistQueryClient-experimental"
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental"
import "./index.css"
import { FlightSearch } from "./components/FlightSearch"
import { QueryClientProvider } from "react-query"

const queryClient = new ReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      // fresh: data shown immediately, NOT queued for refresh
      // stale + cached: data shown immediately, but queued for refresh, then shown after refresh
      // stale + not cached: nothing shown, queued for refresh, shown after refresh
      staleTime: 1000 * 60 * 60 * 12,   // when referenced and online, refresh data every 12hrs
      cacheTime: 1000 * 60 * 60 * 24,   // when unreferenced, drop after 24hrs
      retry: false
    }
  }
})

if (import.meta.env.VITE_REACT_QUERY_CACHE_OFF !== "true") {
  console.debug("Using persistent cache")
  const localStoragePersistor = createWebStoragePersistor({ storage: window.localStorage })
  persistQueryClient({ queryClient, persistor: localStoragePersistor })
} else {
  console.debug("Not using persistent cache")
}

// enabling strict mode will cause problems with reactquery canceling queries when components unmount
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <FlightSearch />
    {import.meta.env.VITE_REACT_QUERY_DEV_TOOLS === "true" && <ReactQueryDevtools initialIsOpen={false} />}
  </QueryClientProvider>
)
