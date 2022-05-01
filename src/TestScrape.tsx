// TODO:
//   - bring back caching between browser reloads
//   - bring loading indicator back
//   - make sure requests are cancelable

import * as React from "react"
import moment from "moment"
import { SearchOutlined } from "@ant-design/icons"
import { Alert, Button, DatePicker, Form } from "antd"
import type { SearchQuery } from "./types/types"
import { SearchResults } from "./SearchResults"
import { SelectAirport } from "./SelectAirport"
import { useAwardSearch } from "./hooks/useAwardSearch"

export const TestScrape = () => {
  console.log("render")

  const defaultSearchQuery: SearchQuery = { origins: ["HNL", "LIH"], destinations: ["SFO"], departureDate: moment().add("1", "day").format("YYYY-MM-DD"), program: "united" }
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(defaultSearchQuery)
  const { searchResults, isLoading, error } = useAwardSearch(searchQuery)

  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  return (
    <>
      <Form initialValues={initialValuesWithMoment} layout="inline" onFinish={(values) => { setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") }) }}>
        <Form.Item name="origins" rules={[{ type: "array", min: 1 }]} style={{ width: 200 }}><SelectAirport placeholder="Origins" /></Form.Item>
        <Form.Item name="destinations" rules={[{ type: "array", min: 1 }]} style={{ width: 200 }}><SelectAirport placeholder="Destinations" /></Form.Item>
        <Form.Item name="departureDate"><DatePicker disabledDate={(current) => current.isBefore(moment().subtract(1, "day"))} allowClear={false} /></Form.Item>
        <Form.Item wrapperCol={{ offset: 2, span: 3 }}><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={isLoading}>Search</Button></Form.Item>
      </Form>

      {error && <Alert message={error.message} type="error" />}
      <SearchResults results={searchResults} isLoading={false} />
    </>
  )
}
