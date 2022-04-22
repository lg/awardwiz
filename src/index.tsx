import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactQuery from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"
import { persistQueryClient } from "react-query/persistQueryClient-experimental"
import { createWebStoragePersistor } from "react-query/createWebStoragePersistor-experimental"
import "./index.css"
import { TestScrape } from "./TestScrape"

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

if (process.env.CACHE_OFF !== "true") {
  console.debug("Using persistent cache")
  const localStoragePersistor = createWebStoragePersistor({ storage: window.localStorage })
  persistQueryClient({ queryClient, persistor: localStoragePersistor })
} else {
  console.debug("Not using persistent cache")
}

// ========================================

ReactDOM.render(
  <React.StrictMode>
    <ReactQuery.QueryClientProvider client={queryClient}>
      <TestScrape />
      <ReactQueryDevtools initialIsOpen={false} />
    </ReactQuery.QueryClientProvider>
  </React.StrictMode>,
  document.getElementById("root")
)
