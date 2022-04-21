import { LoginOutlined, LogoutOutlined, NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { Alert, Button, DatePicker, Form, Input } from "antd"
import * as React from "react"
import * as ReactQuery from "react-query"
import * as moment from "moment"
import axios from "axios"
import { ScraperResults, SearchQuery } from "./scrapers"
import { SearchResults } from "./SearchResults"

export const TestScrape = () => {
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>({ origin: "HNL", destination: "SFO", departureDate: moment().format("YYYY-MM-DD"), program: "united" })

  const { isLoading, error, data } = ReactQuery.useQuery(["awardAvailability", searchQuery], async ({ signal, queryKey }) => {
    const query = queryKey[1] as SearchQuery

    console.log(`[${query.program} ${query.departureDate} ${query.origin}➤${query.destination}] Fetching award availability`)
    const startTime = Date.now()
    const { data: scraperCode } = await axios.get<string>(`/scrapers/${query.program}.js`, { signal })

    const postData = { code: scraperCode, context: { ...query } }
    const { data: results } = await axios.post<ScraperResults>("http://localhost:4000/function", postData, { signal })
    console.log(`[${query.program} ${query.departureDate} ${query.origin}➤${query.destination}] Finished in ${Date.now() - startTime}ms`)

    return results.flightsWithFares
  }, { staleTime: 1000 * 60 * 5, retry: 1 })

  const [formReady, setFormReady] = React.useState(false)   // not sure why this is required, but otherwise react query runs the query on Form.Item render
  React.useEffect(() => { setFormReady(true) }, [])
  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  return (
    <>
      {formReady && (
        <Form name="searchFields" initialValues={initialValuesWithMoment} layout="inline" onFinish={(values) => { setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") }) }}>
          <Form.Item name="origin" style={{ width: 100 }}><Input prefix={<LogoutOutlined />} placeholder="Origin" /></Form.Item>
          <Form.Item name="destination" style={{ width: 100 }}><Input prefix={<LoginOutlined />} placeholder="Destination" /></Form.Item>
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

