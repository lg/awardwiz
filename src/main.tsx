import React from "react"
import ReactDOM from "react-dom/client"
import * as ReactQuery from "@tanstack/react-query"

import { persistQueryClient } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

import "./index.css"
import { FlightSearch } from "./components/FlightSearch"
import { QueryClientProvider } from "@tanstack/react-query"
import { LoginScreen } from "./components/LoginScreen"
import { ScratchPad } from "./components/ScratchPad"

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
  const localStoragePersister = createSyncStoragePersister({ storage: window.localStorage })
  persistQueryClient({ queryClient, persister: localStoragePersister })
} else {
  console.debug("Not using persistent cache")
}

// enabling strict mode will cause problems with reactquery canceling queries when components unmount
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <LoginScreen>
      <FlightSearch />
    </LoginScreen>

    {import.meta.env.VITE_REACT_QUERY_DEV_TOOLS === "true" && <ReactQueryDevtools initialIsOpen={false} />}
    <ScratchPad />
  </QueryClientProvider>
)
