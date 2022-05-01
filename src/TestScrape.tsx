// TODO:
//   - bring back caching between browser reloads
//   - bring loading indicator back
//   - make sure requests are cancelable

import * as React from "react"
import moment from "moment"

import { ExperimentOutlined, NodeIndexOutlined, RocketOutlined, SearchOutlined } from "@ant-design/icons"
import { Alert, Button, DatePicker, Form, Input } from "antd"
import type { SearchQuery } from "./types/types"
import { QueryPairing, ServingCarrier, useServingCarriersQuery } from "./hooks/useServingCarriersQuery"
import { DebugTreeNode, genNewDebugTreeNode, useDebugTree } from "./DebugTree"
import scrapers from "./scrapers/scrapers.json"
import type { ScraperQuery } from "./types/scrapers"
import { useScrapers } from "./hooks/useScrapers"
import { SearchResults } from "./SearchResults"
import { SelectAirport } from "./SelectAirport"

export const TestScrape = () => {
  console.log("render")

  const debugTree = useDebugTree()
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(() => ({ origins: ["HNL", "LIH"], destinations: ["SFO"], departureDate: moment().format("YYYY-MM-DD"), program: "united" }))

  // Take all origins and destinations and create a list of all possible pairs
  const [queryPairings, setQueryPairings] = React.useState<QueryPairing[]>([])  // 1-to-1 mappings of origin/destination (ex. SFO-HNL, OAK-HNL, SJC-HNL)
  React.useEffect(() => {
    console.log(`New search: ${JSON.stringify(searchQuery)}`)
    const pairings = searchQuery.origins.flatMap((origin) => searchQuery.destinations.map((destination) => ({ origin, destination, departureDate: searchQuery.departureDate }) as QueryPairing))
    const debugChildren = pairings.map((pairing) => genNewDebugTreeNode({ key: `${pairing.origin}${pairing.destination}`, textA: `${pairing.origin} → ${pairing.destination}`, textB: "pending", origIcon: <NodeIndexOutlined /> }))

    debugTree({ type: "update", payload: { key: "root", updateData: { textA: `Search for ${searchQuery.origins.join(",")} → ${searchQuery.destinations.join(",")} on ${searchQuery.departureDate}`, children: debugChildren } } })
    setQueryPairings(pairings)
  }, [searchQuery, debugTree])

  // Search each possible pair of origin/destination for which airlines serve the route
  const servingCarriers = useServingCarriersQuery(queryPairings, (origin, destination, statusText, isLoading) => {
    debugTree({ type: "update", payload: { key: `${origin}${destination}`, updateData: { textB: statusText, isLoading } } })
  })
  React.useEffect(() => {
    const origDestCarriers = (JSON.parse(servingCarriers) as ServingCarrier[]).reduce((result, servingCarrier: ServingCarrier) => {
      const scrapedBy = scrapers.filter((scraper) => scraper.supportedAirlines.includes(servingCarrier.airlineCode!)).map((scraper) => scraper.name)
      const debugChild = genNewDebugTreeNode({ key: `${servingCarrier.origin}${servingCarrier.destination}${servingCarrier.airlineCode}`, textA: `${servingCarrier.airlineName}`, textB: scrapedBy.length > 0 ? `Scraped by: ${scrapedBy.join(", ")}` : "Missing scraper", origIcon: <RocketOutlined /> })
      const origDest = `${servingCarrier.origin}${servingCarrier.destination}`

      result[origDest] ||= { debugChildren: [], scrapers: [], origin: servingCarrier.origin, destination: servingCarrier.destination }
      result[origDest].debugChildren.push(debugChild)
      result[origDest].scrapers.push(...scrapedBy)
      return result
    }, {} as { [key: string]: { debugChildren: DebugTreeNode[], scrapers: string[], origin: string, destination: string } })

    // Loop over flight pairings and create queries to run scraper (and also add to debug tree)
    const newScrapeQueries = Object.entries(origDestCarriers).flatMap(([origDestKey, carrierItem]): ScraperQuery[] => {
      const uniqueScrapers = [...new Set(carrierItem.scrapers)]
      const uniqueScraperNodes = uniqueScrapers.map((scraper) => genNewDebugTreeNode({ key: `${origDestKey}${scraper}`, textA: `Scraper: ${scraper}`, origIcon: <ExperimentOutlined /> }))
      debugTree({ type: "update", payload: { key: origDestKey, updateData: { children: carrierItem.debugChildren.concat(uniqueScraperNodes) } } })

      return uniqueScrapers.map((scraper) => ({ scraper, origin: carrierItem.origin, destination: carrierItem.destination, departureDate: searchQuery.departureDate }))
    })
    setScrapeQueries(newScrapeQueries)
  }, [servingCarriers, searchQuery.departureDate, debugTree]) //, searchQuery.departureDate, setDebugTree])

  // Run scrapers given the pairs found above
  const [scrapeQueries, setScrapeQueries] = React.useState<ScraperQuery[]>([])  // 1-to-1 mappings of origin/destination (ex. SFO-HNL, OAK-HNL, SJC-HNL)
  console.log("scrapeQueries", scrapeQueries)
  const searchResults = useScrapers(scrapeQueries, (scraperQuery, statusText, isLoading) => {
    debugTree({ type: "update", payload: { key: `${scraperQuery.origin}${scraperQuery.destination}${scraperQuery.scraper}`, updateData: { textB: statusText, isLoading } } })
  })

  // const isLoading = queries.some((query) => query.isLoading)
  // const error = queries.find((query) => query.isError)?.error
  // const data = queries.filter((query) => query.data).flatMap((query) => query.data) as FlightWithFares[]

  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  const isLoading = false
  const error = undefined
  return (
    <>
      <Form name="searchFields" initialValues={initialValuesWithMoment} layout="inline" onFinish={(values) => { setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") }) }}>
        <Form.Item name="origins" style={{ width: 200 }}><SelectAirport placeholder="Origins" /></Form.Item>
        <Form.Item name="destinations" style={{ width: 200 }}><SelectAirport placeholder="Destinations" /></Form.Item>
        <Form.Item name="departureDate"><DatePicker allowClear={false} /></Form.Item>
        <Form.Item name="program" style={{ width: 200 }}><Input prefix={<NodeIndexOutlined />} placeholder="Program" /></Form.Item>
        <Form.Item wrapperCol={{ offset: 2, span: 3 }}><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={isLoading}>Search</Button></Form.Item>
      </Form>

      {error && <Alert message={(error as Error).message} type="error" />}
      <SearchResults results={searchResults} isLoading={false} />
    </>
  )
}
