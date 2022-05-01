// TODO:
//   - bring back caching between browser reloads
//   - bring loading indicator back
//   - make sure requests are cancelable

import * as React from "react"
import moment from "moment"
import { LeftOutlined, RightOutlined, SearchOutlined, SwapOutlined } from "@ant-design/icons"
import { Alert, Button, DatePicker, Form, Typography } from "antd"
import Moment from "react-moment"
import type { SearchQuery } from "./types/types"
import { SearchResults } from "./SearchResults"
import { SelectAirport } from "./SelectAirport"
import { useAwardSearch } from "./hooks/useAwardSearch"

const { Text } = Typography

export const TestScrape = () => {
  console.log("render")

  const defaultSearchQuery: SearchQuery = { origins: ["HNL", "LIH"], destinations: ["SFO"], departureDate: moment().add("1", "day").format("YYYY-MM-DD"), program: "united" }
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(defaultSearchQuery)
  const { searchResults, isLoading, error, dataNoOlderThan } = useAwardSearch(searchQuery)

  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  const [form] = Form.useForm()
  return (
    <>
      <Form form={form} initialValues={initialValuesWithMoment} layout="inline" onFinish={(values) => { setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") }) }}>
        <Form.Item name="origins" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginRight: 5 }}><SelectAirport placeholder="Origins" /></Form.Item>
        <Button icon={<SwapOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => { form.setFieldsValue({ origins: form.getFieldValue("destinations"), destinations: form.getFieldValue("origins") }) }} />
        <Form.Item name="destinations" rules={[{ type: "array", min: 1 }]} style={{ width: 200 }}><SelectAirport placeholder="Destinations" /></Form.Item>
        <Form.Item name="departureDate" style={{ marginRight: 5 }}><DatePicker disabledDate={(current) => current.isBefore(moment().subtract(1, "day"))} allowClear={false} /></Form.Item>
        <Button icon={<LeftOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => { form.setFieldsValue({ departureDate: moment(form.getFieldValue("departureDate")).subtract("1", "day") }) }} />
        <Button icon={<RightOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => { form.setFieldsValue({ departureDate: moment(form.getFieldValue("departureDate")).add("1", "day") }) }} />
        <Form.Item wrapperCol={{ offset: 2, span: 3 }} style={{ marginLeft: 10 }}><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={isLoading}>Search</Button></Form.Item>
      </Form>

      {error && <Alert message={error.message} type="error" />}
      <SearchResults results={searchResults} isLoading={false} />
      {searchResults.length > 0 && <Text style={{ fontSize: 10 }}>Flight availability as of <Moment interval={1000} date={dataNoOlderThan} fromNow /></Text>}
    </>
  )
}

// {moment.duration(moment().diff(dataNoOlderThan, "minutes")).humanize()}