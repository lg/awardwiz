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
import { FR24SearchResult } from "./fr24"

// possible bug: HNL-LIH not many results

const getScraperCode = (qc: ReactQuery.QueryClient, program: string) => {
  return qc.fetchQuery<string>(["scraper", program], async ({ signal }) => {
    const response = await axios.get<string>(`/scrapers/${program}.js`, { signal })
    return response.data
  })
}

type Scraper = { scraper: string, supportedAirlines: string[] }
const getScrapers = (qc: ReactQuery.QueryClient) => {
  return qc.fetchQuery<Scraper[]>(["scrapers"], async ({ signal }) => {
    return (await axios.get<Scraper[]>("/scrapers.json", { signal })).data
  }, { staleTime: 1000 * 60 })
}

type ServingCarrier = {origin: string, destination: string, airlineCode?: string, airlineName?: string}
const getServingCarriers = (qc: ReactQuery.QueryClient, origin: string, destination: string) => {
  return qc.fetchQuery<ServingCarrier[]>(["servingCarriers", origin, destination], async ({ signal }) => {
    const postData = {
      code: "module.exports=async({page:a,context:b})=>{const{url:c}=b;await a.goto(c);const d=await a.content();const innerText = await a.evaluate(() => document.body.innerText);return{data:JSON.parse(innerText),type:\"application/json\"}};",
      context: { url: `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${origin}&destination=${destination}` }
    }
    const { data } = await axios.post<FR24SearchResult>("http://localhost:4000/function", postData, { signal })

    if (data.errors)
      throw new Error(`${data.errors.message} -- ${JSON.stringify(data.errors.errors)}`)
    if (!data.result.response.flight.data)
      return []

    return data.result.response.flight.data
      .map((item) => ({ origin: item.airport.origin.code.iata, destination: item.airport.destination.code.iata, airlineCode: item.airline?.code.iata, airlineName: item.airline?.name } as ServingCarrier))
      .filter((item, index, self) => self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)   // remove duplicates
      .filter((item) => item.airlineCode && item.airlineName)   // remove flights without sufficient data (usually private flights)
  })
}

export const TestScrape = () => {
  const qc = ReactQuery.useQueryClient()
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>({ origins: ["HNL"], destinations: ["SFO"], departureDate: moment().format("YYYY-MM-DD"), program: "united" })

  const queries = ReactQuery.useQueries<FlightWithFares[]>(
    searchQuery.origins.map((origin) => {
      return searchQuery.destinations.map((destination) => {
        return {
          queryKey: ["awardAvailability", origin, destination, searchQuery.departureDate],
          queryFn: (context: QueryFunctionContext) => awardSearchRoute(origin, destination, searchQuery.departureDate, context.signal)
        }
      })
    }, { staleTime: 1000 * 60 * 5, retry: 1 }).flatMap((x) => x)
  )

  const awardSearchRoute = async (origin: string, destination: string, departureDate: string, signal?: AbortSignal) => {
    const allCarriers = await getServingCarriers(qc, origin, destination)

    const compatibleScrapers = (await getScrapers(qc)).filter((scraper) => {
      return scraper.supportedAirlines.some((supportedAirlineCode) => allCarriers.some((carrier) => carrier.airlineCode === supportedAirlineCode))
    })

    const scraperResults = await Promise.all(compatibleScrapers.map(async (program) => {
      const scraperCode = await getScraperCode(qc, program.scraper)
      const postData = { code: scraperCode, context: { origin, destination, departureDate } as ScraperQuery }
      return (await axios.post<ScraperResults>("http://localhost:4000/function", postData, { signal })).data
    }))

    return scraperResults.flatMap((scraperResult) => scraperResult.flightsWithFares)
  }

  const isLoading = queries.some((query) => query.isLoading)
  const error = queries.find((query) => query.isError)?.error
  const data = queries.filter((query) => query.data).flatMap((query) => query.data) as FlightWithFares[]

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
