import * as React from "react"
import { SearchResults } from "./SearchResults.js"
import { useAwardSearch } from "../hooks/useAwardSearch.js"
import { AwardSearchDebugTree } from "./AwardSearchDebugTree.js"
import { SearchQuery } from "../types/scrapers.js"
import { FlightSearchForm } from "./FlightSearchForm.js"
import { default as dayjs, Dayjs } from "dayjs"

export const FlightSearch = () => {
  // eslint-disable-next-line no-console
  console.log("render")

  const defaultSearchQuery = { origins: ["SFO"], destinations: ["HNL", "LIH"], departureDate: dayjs().format("YYYY-MM-DD") }
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(() => {
    const receivedDate = JSON.parse(localStorage.getItem("searchQuery") ?? JSON.stringify(defaultSearchQuery)) as typeof defaultSearchQuery
    if (dayjs(receivedDate.departureDate).isBefore(dayjs()))
      receivedDate.departureDate = defaultSearchQuery.departureDate
    return receivedDate
  })
  const searchProgress = useAwardSearch(searchQuery)

  // Save last query in browser
  React.useEffect(() => localStorage.setItem("searchQuery", JSON.stringify(searchQuery)), [searchQuery])

  const onSearchClick = React.useCallback((values: { origins: string[], destinations: string[], departureDate: Dayjs }): void => {
    if (searchProgress.loadingQueriesKeys.length > 0) {
      void searchProgress.stop()
      return
    }
    setSearchQuery({ ...values, departureDate: dayjs(values.departureDate).format("YYYY-MM-DD") })
  }, [searchProgress])

  return (
    <>
      <FlightSearchForm searchQuery={searchQuery} isSearching={searchProgress.loadingQueriesKeys.length > 0} onSearchClick={onSearchClick} />
      <SearchResults results={searchProgress.searchResults} isLoading={false} />

      <AwardSearchDebugTree searchQuery={searchQuery} {...searchProgress} />
    </>
  )
}
