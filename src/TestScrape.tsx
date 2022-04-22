import { NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { Alert, Button, DatePicker, Form, Input } from "antd"
import * as React from "react"
import * as ReactQuery from "react-query"
import * as moment from "moment"
import axios from "axios"
import { QueryFunctionContext } from "react-query"

import { FlightWithFares, ScraperQuery, ScraperResults, SearchQuery } from "./scrapers"
import { SearchResults } from "./SearchResults"
import { SelectAirport } from "./SelectAirport"

// possible bug: HNL-LIH not many results

export const TestScrape = () => {
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>({ origins: ["HNL"], destinations: ["SFO"], departureDate: moment().format("YYYY-MM-DD"), program: "united" })

  const queries = ReactQuery.useQueries<FlightWithFares[]>(
    searchQuery.origins.map((origin) => {
      return searchQuery.destinations.map((destination) => {
        return {
          queryKey: ["awardAvailability", origin, destination, searchQuery.departureDate, searchQuery.program],
          queryFn: (context: QueryFunctionContext) => awardSearch({ origin, destination, departureDate: searchQuery.departureDate, program: searchQuery.program }, context.signal)
        }
      })
    }, { staleTime: 1000 * 60 * 5, retry: 1 }).flatMap((x) => x)
  )

  const isLoading = queries.some((query) => query.isLoading)
  const error = queries.find((query) => query.isError)?.error
  const data = queries.filter((query) => query.data).flatMap((query) => query.data) as FlightWithFares[]

  const awardSearch = async (query: ScraperQuery, signal?: AbortSignal) => {
    console.log(`[${query.program} ${query.departureDate} ${query.origin}➤${query.destination}] Fetching award availability`)
    const startTime = Date.now()
    const { data: scraperCode } = await axios.get<string>(`/scrapers/${query.program}.js`, { signal })

    const postData = { code: scraperCode, context: { ...query } }
    const { data: results } = await axios.post<ScraperResults>("http://localhost:4000/function", postData, { signal })

    console.log(`[${query.program} ${query.departureDate} ${query.origin}➤${query.destination}] Finished in ${Date.now() - startTime}ms with ${results.flightsWithFares.length} flights`)
    return results.flightsWithFares
  }

  const [formReady, setFormReady] = React.useState(false)   // not sure why this is required, but otherwise react query runs the query on Form.Item render
  React.useEffect(() => { setFormReady(true) }, [])
  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  return (
    <>
      {formReady && (
        <Form name="searchFields" initialValues={initialValuesWithMoment} layout="inline" onFinish={(values) => { setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") }) }}>
          <Form.Item name="origins" style={{ width: 200 }}><SelectAirport placeholder="Origins" /></Form.Item>
          <Form.Item name="destinations" style={{ width: 200 }}><SelectAirport placeholder="Destinations" /></Form.Item>
          <Form.Item name="departureDate"><DatePicker allowClear={false} /></Form.Item>
          <Form.Item name="program" style={{ width: 200 }}><Input prefix={<NodeIndexOutlined />} placeholder="Program" /></Form.Item>
          <Form.Item wrapperCol={{ offset: 2, span: 3 }}><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={isLoading}>Search</Button></Form.Item>
        </Form>
      )}
      {error && <Alert message={(error as Error).message} type="error" />}
      <SearchResults results={data} isLoading={isLoading} />
    </>
  )
}
