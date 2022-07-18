import * as React from "react"
import moment_ from "moment"
import { LeftOutlined, RightOutlined, SearchOutlined, SwapOutlined } from "@ant-design/icons"
import { Alert, Button, DatePicker, Form } from "antd"
import { SearchResults } from "./SearchResults"
import { SelectAirport } from "./SelectAirport"
import { useAwardSearch } from "../hooks/useAwardSearch"
import { DebugTree } from "./DebugTree"
import { useAwardSearchDebugTree } from "../hooks/useAwardSearchDebugTree"
import { SearchQuery } from "../types/scrapers"
import { supabase } from "./LoginScreen"
const moment = moment_

export const FlightSearch = () => {
  console.log("render")

  const defaultSearchQuery = { origins: ["SFO"], destinations: ["HNL", "LIH"], departureDate: moment().add("1", "day").format("YYYY-MM-DD") }
  const [searchQuery, setSearchQuery] = React.useState<SearchQuery>(() => {
    const receivedDate = JSON.parse(localStorage.getItem("searchQuery") || JSON.stringify(defaultSearchQuery))
    if (moment(receivedDate.departureDate).isBefore(moment()))
      receivedDate.departureDate = defaultSearchQuery.departureDate
    return receivedDate
  })
  const searchProgress = useAwardSearch(searchQuery)
  const { debugTree, debugTreeRootKey } = useAwardSearchDebugTree({ searchQuery, ...searchProgress })

  React.useEffect(() => {
    localStorage.setItem("searchQuery", JSON.stringify(searchQuery))
    const logSearch = async (query: object) => supabase.from("searches").insert([{ user_id: supabase.auth.session()?.user?.id, query }])
    logSearch(searchQuery)
  }, [searchQuery])

  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  const [form] = Form.useForm()
  return (
    <>
      <Form form={form} initialValues={initialValuesWithMoment} layout="inline" onFinish={(values) => { setSearchQuery({ ...values, departureDate: moment(values.departureDate).format("YYYY-MM-DD") }) }}>
        <Form.Item name="origins" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginRight: 5, marginBottom: 0 }}><SelectAirport placeholder="Origins" /></Form.Item>
        <Button icon={<SwapOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => { form.setFieldsValue({ origins: form.getFieldValue("destinations"), destinations: form.getFieldValue("origins") }) }} />
        <Form.Item name="destinations" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginBottom: 0 }}><SelectAirport placeholder="Destinations" /></Form.Item>
        <Form.Item name="departureDate" style={{ marginRight: 5 }}><DatePicker disabledDate={(current) => current.isBefore(moment().subtract(1, "day"))} allowClear={false} /></Form.Item>
        <Button icon={<LeftOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => { form.setFieldsValue({ departureDate: moment(form.getFieldValue("departureDate")).subtract("1", "day") }) }} />
        <Button icon={<RightOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => { form.setFieldsValue({ departureDate: moment(form.getFieldValue("departureDate")).add("1", "day") }) }} />
        <Form.Item wrapperCol={{ offset: 2, span: 3 }} style={{ marginLeft: 10 }}><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={searchProgress.loadingQueriesKeys.length > 0}>Search</Button></Form.Item>
      </Form>

      {searchProgress.errors.length > 0 && <Alert showIcon message={searchProgress.errors.map((error) => `${error.queryKey}: ${error.error.message}`).join(", ")} type="error" />}
      <SearchResults results={searchProgress.searchResults} isLoading={false} />
      <DebugTree debugTree={debugTree} rootKey={debugTreeRootKey} />
    </>
  )
}
