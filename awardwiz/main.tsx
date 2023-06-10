import { createRoot } from "react-dom/client"
import * as ReactQuery from "@tanstack/react-query"

import { persistQueryClient } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"

import "./index.css"
import { FlightSearch } from "./components/FlightSearch.js"
import { QueryClientProvider } from "@tanstack/react-query"
import { LoginScreen } from "./components/LoginScreen.js"

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
  // eslint-disable-next-line no-console
  console.debug("Using persistent cache")
  const localStoragePersister = createSyncStoragePersister({ storage: window.localStorage })
  persistQueryClient({ queryClient, persister: localStoragePersister })
} else {
  // eslint-disable-next-line no-console
  console.debug("Not using persistent cache")
}

// enabling strict mode will cause problems with reactquery canceling queries when components unmount
createRoot(document.querySelector("#root")!).render(
  <QueryClientProvider client={queryClient}>
    <LoginScreen>
      <FlightSearch />
    </LoginScreen>

    <div style={{position: "fixed", bottom: 0, right: 0, padding: 5, backgroundColor: "#FFF9CC" }}>
      <a href="https://awardwiz.grafana.net/public-dashboards/48c620f74daf42b4b24d0b1cf86300f5">Stats</a>
      <a href="https://github.com/lg/awardwiz" style={{marginLeft: 10}}>Github</a>
    </div>
  </QueryClientProvider>
)
