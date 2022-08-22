import * as React from "react"
import moment_, { Moment } from "moment"
import { SearchResults } from "./SearchResults"
import { useAwardSearch } from "../hooks/useAwardSearch"
import { AwardSearchDebugTree } from "./AwardSearchDebugTree"
import { SearchQuery } from "../types/scrapers"
import { supabase } from "./LoginScreen"
import { FlightSearchForm } from "./FlightSearchForm"
const moment = moment_

export const FlightSearch = () => {
  console.log("render")

  const defaultSearchQuery = { origins: ["SFO"], destinations: ["HNL", "LIH"], departureDate: moment().add("1", "day").format("YYYY-MM-DD") }
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(() => {
    const receivedDate = JSON.parse(localStorage.getItem("searchQuery") ?? JSON.stringify(defaultSearchQuery))
    if (moment(receivedDate.departureDate).isBefore(moment()))
      receivedDate.departureDate = defaultSearchQuery.departureDate
    return receivedDate
  })
  const searchProgress = useAwardSearch(searchQuery)

  React.useEffect(() => {
    localStorage.setItem("searchQuery", JSON.stringify(searchQuery))
    const logSearch = async (query: SearchQuery) => supabase.from("searches").insert([{ user_id: (await supabase.auth.getUser()).data.user?.id, query: JSON.stringify(query) }])
    void logSearch(searchQuery)
  }, [searchQuery])

  const onSearchClick = React.useCallback(async (values: { origins: string[], destinations: string[], departureDate: Moment }) => {
    if (searchProgress.loadingQueriesKeys.length > 0)
      return searchProgress.stop()
    return setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") })
  }, [searchProgress])

  return (
    <>
      <FlightSearchForm searchQuery={searchQuery} isSearching={searchProgress.loadingQueriesKeys.length > 0} onSearchClick={onSearchClick} />
      <SearchResults results={searchProgress.searchResults} isLoading={false} />

      <AwardSearchDebugTree searchQuery={searchQuery} {...searchProgress} />
    </>
  )
}
