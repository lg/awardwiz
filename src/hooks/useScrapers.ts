import axios from "axios"
import * as ReactQuery from "react-query"
import { FlightWithFares, ScraperQuery, ScraperResults } from "../types/scrapers"
const scraperCode = import.meta.glob("../scrapers/*.js", { as: "raw" })

export const useScrapers = (searches: ScraperQuery[], queryProgress: (scraperQuery: ScraperQuery, statusText: string, isLoading: boolean) => void) => {
  const searchQueries = ReactQuery.useQueries(
    searches.map((scraperQuery) => {
      return {
        queryKey: ["awardAvailability", scraperQuery],
        queryFn: async ({ signal }) => {
          const startTime = Date.now()
          queryProgress(scraperQuery, "Searching...", true)

          const path = Object.keys(scraperCode).find((key) => key.indexOf(`${scraperQuery.scraper}.js`) > -1)
          if (!path)
            throw new Error(`Could not find scraper ${scraperQuery.scraper}`)
          const code = scraperCode[path]

          const postData = { code, context: scraperQuery }
          const scraperResults = (await axios.post<ScraperResults>("http://localhost:4000/function", postData, { signal })).data
          queryProgress(scraperQuery, `Success after ${Date.now() - startTime}ms`, false)
          return scraperResults.flightsWithFares
        },
        onError: (err: Error) => queryProgress(scraperQuery, `Error: ${err.message}`, false),
      } as ReactQuery.UseQueryOptions<FlightWithFares[]>
    })
  )

  const scraperResults = searchQueries
    .filter((item) => item.data)
    .map((item) => item.data)
    .flat()
  return scraperResults as FlightWithFares[]
}
