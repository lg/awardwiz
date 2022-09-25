import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { renderHook } from "@testing-library/react"
import { useAwardSearch } from "../hooks/useAwardSearch"
import { SearchQuery } from "../types/scrapers"
import pWaitFor from "p-wait-for"
import { ReactElement } from "react"

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!global.window)
  GlobalRegistrator.register()

export const genQueryClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, cacheTime: Infinity, retry: false } } })

export const search = async (searchQuery: SearchQuery, queryClient: QueryClient) => {
  const wrapper = ({ children }: { children: ReactElement }) => QueryClientProvider({ client: queryClient, children })
  const { result } = renderHook(() => useAwardSearch(searchQuery), { wrapper })
  await pWaitFor(() => result.current.loadingQueriesKeys.length === 0, { timeout: { milliseconds: 30000, fallback: () => result.current.stop() } })

  return result.current
}
