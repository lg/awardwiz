import React from "react"
import * as ReactQuery from "@tanstack/react-query"
import { DebugTreeNode } from "../components/DebugTree"
import Text from "antd/lib/typography/Text"
import CarbonPaintBrush from "~icons/carbon/paint-brush"
import CarbonCircleDash from "~icons/carbon/circle-dash"
import { NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { AwardSearchProgress, doesScraperSupportAirlineExclCashOnly, scraperConfig, } from "./useAwardSearch"
import { SearchQuery } from "../types/scrapers"
import CarbonWarningAlt from "~icons/carbon/warning-alt"

export const useAwardSearchDebugTree = ({ searchQuery, pairings, servingCarriers, scrapersForRoutes, loadingQueriesKeys, errors }: AwardSearchProgress & { searchQuery: SearchQuery }) => {
  const airlineNameByCode = (code: string) => servingCarriers.find((carrier) => carrier.airlineCode === code)?.airlineName ?? code

  const debugTreeRootKey = searchQuery.origins.concat(searchQuery.destinations).concat(searchQuery.departureDate).join("-")
  const debugTree: DebugTreeNode[] = []

  debugTree.push({
    key: debugTreeRootKey,
    parentKey: "",
    text: <>Search for {searchQuery.origins.join(", ")} → {searchQuery.destinations.join(", ")} on {searchQuery.departureDate}</>,
    stableIcon: <SearchOutlined />,
    isLoading: loadingQueriesKeys.length > 0,
    error: undefined
  })

  debugTree.push(...pairings.map((pairing): DebugTreeNode => {
    const queryKey: ReactQuery.QueryKey = [`servingCarriers-${pairing.origin}-${pairing.destination}`]
    return {
      key: `${pairing.origin}${pairing.destination}`,
      parentKey: debugTreeRootKey,
      text: <>{pairing.origin} → {pairing.destination}</>,
      stableIcon: <NodeIndexOutlined />,
      isLoading: loadingQueriesKeys.some((check) => ReactQuery.hashQueryKey(check) === ReactQuery.hashQueryKey(queryKey)),
      error: errors.find((query) => ReactQuery.hashQueryKey(query.queryKey) === ReactQuery.hashQueryKey(queryKey))?.error
    }
  }))

  debugTree.push(...Object.entries(scrapersForRoutes).map(([key, scraperForRoute]): DebugTreeNode => {
    const queryKey: ReactQuery.QueryKey = [`awardAvailability-${key}-${scraperForRoute.departureDate}`]
    const isCashOnlyScraper = scraperConfig.scrapers.find((checkScraper) => checkScraper.name === scraperForRoute.scraper)?.cashOnlyFares
    return {
      key,
      parentKey: `${scraperForRoute.origin}${scraperForRoute.destination}`,
      text: <><Text code>{scraperForRoute.scraper}</Text>: {isCashOnlyScraper ? "Cash-to-points fares" : scraperForRoute.matchedAirlines.map((airline) => airlineNameByCode(airline)).join(", ")}</>,
      stableIcon: <CarbonPaintBrush />,
      isLoading: loadingQueriesKeys.some((check) => ReactQuery.hashQueryKey(check) === ReactQuery.hashQueryKey(queryKey)),
      error: errors.find((query) => ReactQuery.hashQueryKey(query.queryKey) === ReactQuery.hashQueryKey(queryKey))?.error
    }
  }))

  pairings.forEach((pairing) => {
    const airlinesForPairing = servingCarriers.filter((item) => item.origin === pairing.origin && item.destination === pairing.destination).map((item) => item.airlineCode)
    if (airlinesForPairing.length === 0) {
      if (!loadingQueriesKeys.some((item) => ReactQuery.hashQueryKey(item) === ReactQuery.hashQueryKey([`servingCarriers-${pairing.origin}-${pairing.destination}`]))) {  // dont display if still loading pairings
        debugTree.push({
          key: `${pairing.origin}${pairing.destination}-no-carriers`,
          parentKey: `${pairing.origin}${pairing.destination}`,
          text: <>(No carriers serving this route)</>,
          stableIcon: <CarbonWarningAlt />,
          isLoading: false,
          error: undefined
        })
      }

    } else {
      const airlinesMissingScrapers = airlinesForPairing.filter((airline) => {
        return !scraperConfig.scrapers.some((scraper) => {
          return doesScraperSupportAirlineExclCashOnly(scraper, airline)
        })
      })

      if (airlinesMissingScrapers.length > 0) {
        debugTree.push({
          key: `${pairing.origin}${pairing.destination}-no-scraper`,
          parentKey: `${pairing.origin}${pairing.destination}`,
          text: <>Missing: {airlinesMissingScrapers.map((airline) => `${airlineNameByCode(airline)} (${airline})`).join(", ")}</>,
          stableIcon: <CarbonCircleDash />,
          isLoading: false,
          error: undefined
        })
      }
    }
  })

  return { debugTree, debugTreeRootKey }
}
