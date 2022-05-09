import React from "react"
import { useQueryClient } from "react-query"
import { DebugTreeNode } from "../components/DebugTree"
import Text from "antd/lib/typography/Text"
import CarbonPaintBrush from "~icons/carbon/paint-brush"
import CarbonCircleDash from "~icons/carbon/circle-dash"
import { NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { QueryPairing, ScrapersForRoutes, ServingCarrier } from "./useAwardSearch"
import { SearchQuery } from "../types/types"

export type AwardSearchDebugTreeInput = { searchQuery: SearchQuery, scrapersForRoutes: ScrapersForRoutes, isLoading: boolean, pairings: QueryPairing[], servingCarriers: ServingCarrier[] }
export const useAwardSearchDebugTree = ({ searchQuery, isLoading, pairings, scrapersForRoutes, servingCarriers }: AwardSearchDebugTreeInput) => {
  const queryClient = useQueryClient()

  const debugTree: DebugTreeNode[] = []
  const debugTreeRootKey = searchQuery.origins.concat(searchQuery.destinations).join("-")

  debugTree.push({
    key: debugTreeRootKey,
    parentKey: "",
    text: <>Search for {searchQuery.origins.join(", ")} → {searchQuery.destinations.join(", ")} on {searchQuery.departureDate}</>,
    stableIcon: <SearchOutlined />,
    isLoading,
    error: undefined
  })

  debugTree.push(...pairings.map((pairing) => ({
    key: `${pairing.origin}${pairing.destination}`,
    parentKey: debugTreeRootKey,
    text: <>{pairing.origin} → {pairing.destination}</>,
    stableIcon: <NodeIndexOutlined />,
    isLoading: queryClient.getQueryState(["servingCarriers", pairing.origin, pairing.destination])?.status === "loading",
    error: queryClient.getQueryState(["servingCarriers", pairing.origin, pairing.destination])?.error || undefined,
  })))

  debugTree.push(...Object.entries(scrapersForRoutes).map(([key, scraperForRoute]) => ({
    key,
    parentKey: `${scraperForRoute.origin}${scraperForRoute.destination}`,
    text: <><Text code>{scraperForRoute.scraper}</Text>: {scraperForRoute.matchedAirlines.join(", ")}</>,
    stableIcon: <CarbonPaintBrush />,
    isLoading: queryClient.getQueryState(["awardAvailability", key, scraperForRoute.departureDate])?.status === "loading",
    error: queryClient.getQueryState(["awardAvailability", key, scraperForRoute.departureDate])?.error || undefined,
  })))

  pairings.forEach((pairing) => {
    const noScrapersForAirlines = Object.values(servingCarriers)
      .filter((servingCarrier) => servingCarrier.origin === pairing.origin && servingCarrier.destination === pairing.destination)
      .filter((servingCarrier) => !Object.values(scrapersForRoutes).some((scraperForRoute) => scraperForRoute.matchedAirlines.includes(servingCarrier.airlineName)))

    if (noScrapersForAirlines.length > 0) {
      debugTree.push({
        key: `${pairing.origin}${pairing.destination}-no-scraper`,
        parentKey: `${pairing.origin}${pairing.destination}`,
        text: <>Missing: {noScrapersForAirlines.map((servingCarrier) => servingCarrier.airlineName).join(", ")}</>,
        stableIcon: <CarbonCircleDash />,
        isLoading: false,
        error: undefined
      })
    }
  })

  return { debugTree, debugTreeRootKey }
}
