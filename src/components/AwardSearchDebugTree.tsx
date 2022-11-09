import * as ReactQuery from "@tanstack/react-query"
import { DebugTree, DebugTreeNode } from "./DebugTree"
import Text from "antd/lib/typography/Text"
import CarbonPaintBrush from "~icons/carbon/paint-brush"
import CarbonCircleDash from "~icons/carbon/circle-dash"
import { NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { AwardSearchProgress, doesScraperSupportAirline, queryKeyForAirlineRoute, queryKeyForScraperResponse, queryKeysEqual, scraperConfig, } from "../hooks/useAwardSearch"
import { SearchQuery } from "../types/scrapers"
import CarbonWarningAlt from "~icons/carbon/warning-alt"
import { ScraperResultDetails } from "./ScraperResultDetails"

export const AwardSearchDebugTree = ({ searchQuery, datedRoutes, airlineRoutes, scrapersToRun, scraperResponses, loadingQueriesKeys, errors }: AwardSearchProgress & { searchQuery: SearchQuery }) => {
  const airlineNameByCode = (code: string) => airlineRoutes.find((airlineRoute) => airlineRoute.airlineCode === code)?.airlineName ?? code

  const debugTreeRootKey = [...searchQuery.origins, ...searchQuery.destinations, ...searchQuery.departureDate].join("-")
  const debugTree: DebugTreeNode[] = []

  debugTree.push({
    key: debugTreeRootKey,
    parentKey: "",
    text: <>Search for {searchQuery.origins.join(", ")} → {searchQuery.destinations.join(", ")} on {searchQuery.departureDate}</>,
    stableIcon: <SearchOutlined />,
    isLoading: loadingQueriesKeys.length > 0,
    error: undefined
  })

  debugTree.push(...datedRoutes.map((datedRoute): DebugTreeNode => {
    const queryKey: ReactQuery.QueryKey = queryKeyForAirlineRoute(datedRoute)
    return {
      key: `${datedRoute.origin}${datedRoute.destination}`,
      parentKey: debugTreeRootKey,
      text: <>{datedRoute.origin} → {datedRoute.destination}</>,
      stableIcon: <NodeIndexOutlined />,
      isLoading: loadingQueriesKeys.some((check) => queryKeysEqual(check, queryKey)),
      error: !!errors.find((query) => queryKeysEqual(query.queryKey, queryKey))?.error,
    }
  }))

  debugTree.push(...scrapersToRun.map((scraperToRun): DebugTreeNode => {
    const queryKey = queryKeyForScraperResponse(scraperToRun)
    const isCashOnlyScraper = scraperConfig.scrapers.find((checkScraper) => checkScraper.name === scraperToRun.scraperName)?.cashOnlyFares
    const response = scraperResponses.find((check) => check.forKey && queryKeysEqual(check.forKey, queryKey))
    const retries = response?.retries ?? 0

    return {
      key: queryKey.toString(),
      parentKey: `${scraperToRun.forDatedRoute.origin}${scraperToRun.forDatedRoute.destination}`,
      text: (
        <>
          <Text code>{scraperToRun.scraperName}</Text>:
          { isCashOnlyScraper ? " Cash-to-points fares" : (` ${scraperToRun.forAirlines.map((airline) => airlineNameByCode(airline)).join(", ")}`) }
          { retries > 0
            ? <Text style={{ fontSize: "0.75em", color: "#ff0000" }}><strong> ({retries} {retries === 1 ? "retry" : "retries"})</strong></Text>
            : "" }
        </>
      ),
      stableIcon: <CarbonPaintBrush />,
      isLoading: loadingQueriesKeys.some((check) => queryKeysEqual(check, queryKey)),
      error: !!errors.find((query) => queryKeysEqual(query.queryKey, queryKey))?.error,
      details: <ScraperResultDetails response={response} queryKey={queryKey} />
    }
  }))

  for (const datedRoute of datedRoutes) {
    const airlineCodesForRoute = airlineRoutes.filter((item) => item.origin === datedRoute.origin && item.destination === datedRoute.destination).map((item) => item.airlineCode)
    if (airlineCodesForRoute.length === 0) {
      if (!loadingQueriesKeys.some((item) => queryKeysEqual(item, queryKeyForAirlineRoute(datedRoute)))) {  // dont display if still loading route
        debugTree.push({
          key: `${datedRoute.origin}${datedRoute.destination}-no-airlines`,
          parentKey: `${datedRoute.origin}${datedRoute.destination}`,
          text: <>(No airlines serving this route)</>,
          stableIcon: <CarbonWarningAlt />,
          isLoading: false,
          error: undefined
        })
      }

    } else {
      const airlinesMissingScrapers = airlineCodesForRoute.filter((code) => {
        return !scraperConfig.scrapers.some((scraper) => {
          return doesScraperSupportAirline(scraper, code, false)
        })
      })

      if (airlinesMissingScrapers.length > 0) {
        debugTree.push({
          key: `${datedRoute.origin}${datedRoute.destination}-no-scraper`,
          parentKey: `${datedRoute.origin}${datedRoute.destination}`,
          text: <>Missing: {airlinesMissingScrapers.map((airline) => `${airlineNameByCode(airline)} (${airline})`).join(", ")}</>,
          stableIcon: <CarbonCircleDash />,
          isLoading: false,
          error: undefined
        })
      }
    }
  }

  return <DebugTree debugTree={debugTree} rootKey={debugTreeRootKey} />
}
