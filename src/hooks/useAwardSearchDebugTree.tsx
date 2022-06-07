import React from "react"
import { DebugTreeNode } from "../components/DebugTree"
import Text from "antd/lib/typography/Text"
import CarbonPaintBrush from "~icons/carbon/paint-brush"
import CarbonCircleDash from "~icons/carbon/circle-dash"
import { NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { QueryPairing, ScrapersForRoutes, ServingCarrier } from "./useAwardSearch"
import { SearchQuery } from "../types/scrapers"
import CarbonWarningAlt from "~icons/carbon/warning-alt"

const arrEq = (arr1: any[], arr2: any[]) => JSON.stringify(arr1) === JSON.stringify(arr2)

export type AwardSearchDebugTreeInput = { searchQuery: SearchQuery, scrapersForRoutes: ScrapersForRoutes, loadingQueries: string[][], errors: { queryKey: string[], error: Error }[], pairings: QueryPairing[], servingCarriers: ServingCarrier[] }
export const useAwardSearchDebugTree = ({ searchQuery, loadingQueries, errors, pairings, scrapersForRoutes, servingCarriers }: AwardSearchDebugTreeInput) => {
  const debugTreeRootKey = searchQuery.origins.concat(searchQuery.destinations).concat(searchQuery.departureDate).join("-")

  const tree = React.useMemo(() => {
    const debugTree: DebugTreeNode[] = []

    debugTree.push({
      key: debugTreeRootKey,
      parentKey: "",
      text: <>Search for {searchQuery.origins.join(", ")} → {searchQuery.destinations.join(", ")} on {searchQuery.departureDate}</>,
      stableIcon: <SearchOutlined />,
      isLoading: loadingQueries.length > 0,
      error: undefined
    })

    debugTree.push(...pairings.map((pairing) => ({
      key: `${pairing.origin}${pairing.destination}`,
      parentKey: debugTreeRootKey,
      text: <>{pairing.origin} → {pairing.destination}</>,
      stableIcon: <NodeIndexOutlined />,
      isLoading: !!loadingQueries.find((item) => arrEq(item, ["servingCarriers", pairing.origin, pairing.destination])),
      error: errors.find((item) => arrEq(item.queryKey, ["servingCarriers", pairing.origin, pairing.destination]))?.error
    })))

    debugTree.push(...Object.entries(scrapersForRoutes).map(([key, scraperForRoute]) => ({
      key,
      parentKey: `${scraperForRoute.origin}${scraperForRoute.destination}`,
      text: <><Text code>{scraperForRoute.scraper}</Text>: {scraperForRoute.matchedAirlines.join(", ")}</>,
      stableIcon: <CarbonPaintBrush />,
      isLoading: !!loadingQueries.find((item) => arrEq(item, ["awardAvailability", key, scraperForRoute.departureDate])),
      error: errors.find((item) => arrEq(item.queryKey, ["awardAvailability", key, scraperForRoute.departureDate]))?.error
    })))

    pairings.forEach((pairing) => {
      const noScrapersForAirlines = Object.values(servingCarriers)
        .filter((servingCarrier) => servingCarrier.origin === pairing.origin && servingCarrier.destination === pairing.destination)
        .filter((servingCarrier) => !Object.values(scrapersForRoutes).some((scraperForRoute) => scraperForRoute.matchedAirlines.includes(servingCarrier.airlineName)))

      if (noScrapersForAirlines.length > 0) {
        debugTree.push({
          key: `${pairing.origin}${pairing.destination}-no-scraper`,
          parentKey: `${pairing.origin}${pairing.destination}`,
          text: <>Missing: {noScrapersForAirlines.map((servingCarrier) => `${servingCarrier.airlineName} (${servingCarrier.airlineCode})`).join(", ")}</>,
          stableIcon: <CarbonCircleDash />,
          isLoading: false,
          error: undefined
        })

      } else if (!servingCarriers.some((servingCarrier) => servingCarrier.origin === pairing.origin && servingCarrier.destination === pairing.destination)
          && !loadingQueries.find((item) => arrEq(item, ["servingCarriers", pairing.origin, pairing.destination]))) {
        debugTree.push({
          key: `${pairing.origin}${pairing.destination}-no-carriers`,
          parentKey: `${pairing.origin}${pairing.destination}`,
          text: <>(No carriers serving this route)</>,
          stableIcon: <CarbonWarningAlt />,
          isLoading: false,
          error: undefined
        })
      }
    })

    return debugTree
  }, [debugTreeRootKey, loadingQueries, errors, pairings, scrapersForRoutes, searchQuery, servingCarriers])

  return { debugTree: tree, debugTreeRootKey }
}
