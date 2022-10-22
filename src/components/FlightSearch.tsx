import * as React from "react"
import { SearchResults } from "./SearchResults"
import { useAwardSearch } from "../hooks/useAwardSearch"
import { AwardSearchDebugTree } from "./AwardSearchDebugTree"
import { SearchQuery } from "../types/scrapers"
import { supabase } from "./LoginScreen"
import { FlightSearchForm } from "./FlightSearchForm"
import { default as dayjs, Dayjs } from "dayjs"

export const FlightSearch = () => {
  console.log("render")

  const defaultSearchQuery = { origins: ["SFO"], destinations: ["HNL", "LIH"], departureDate: dayjs().add(1, "day").format("YYYY-MM-DD") }
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(() => {
    const receivedDate = JSON.parse(localStorage.getItem("searchQuery") ?? JSON.stringify(defaultSearchQuery))
    if (dayjs(receivedDate.departureDate).isBefore(dayjs()))
      receivedDate.departureDate = defaultSearchQuery.departureDate
    return receivedDate
  })
  const searchProgress = useAwardSearch(searchQuery)

  React.useEffect(() => {
    localStorage.setItem("searchQuery", JSON.stringify(searchQuery))
    const logSearch = async (query: SearchQuery) => {
      const user = await supabase.auth.getUser()
      return supabase.from("searches").insert([{ user_id: user.data.user?.id, query: JSON.stringify(query) }])
    }
    void logSearch(searchQuery)
  }, [searchQuery])

  const onSearchClick = React.useCallback(async (values: { origins: string[], destinations: string[], departureDate: Dayjs }) => {
    if (searchProgress.loadingQueriesKeys.length > 0)
      return searchProgress.stop()
    return setSearchQuery({ ...values, departureDate: dayjs(values.departureDate).format("YYYY-MM-DD") })
  }, [searchProgress])

  return (
    <>
      <FlightSearchForm searchQuery={searchQuery} isSearching={searchProgress.loadingQueriesKeys.length > 0} onSearchClick={onSearchClick} />
      <SearchResults results={searchProgress.searchResults} isLoading={false} />

      <AwardSearchDebugTree searchQuery={searchQuery} {...searchProgress} />
    </>
  )
}
