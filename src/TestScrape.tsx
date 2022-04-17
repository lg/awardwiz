import { LoginOutlined, LogoutOutlined, NodeIndexOutlined, SearchOutlined } from "@ant-design/icons"
import { Button, DatePicker, Form, Input } from "antd"
import * as React from "react"
import * as ReactQuery from "react-query"
import * as moment from "moment"

export const TestScrape = () => {
  type SearchQuery = {
    origin: string
    destination: string
    departureDate: moment.Moment
    program: string
  }

  const today = moment()

  const [form] = Form.useForm()
  const [origin, setOrigin] = React.useState("")
  const [destination, setDestination] = React.useState("")
  const [departureDate, setDepartureDate] = React.useState(today)
  const [awardProgram, setAwardProgram] = React.useState("")

  const { isLoading, error, data } = ReactQuery.useQuery(["awardAvailability", origin, destination, departureDate, awardProgram], ({ signal }) => {
    if (!origin || !destination || !departureDate || !awardProgram)
      return null

    console.log(`Fetching award availability for ${origin} to ${destination} on ${departureDate.format("YYYY-MM-DD")} using ${awardProgram}`)
  })

  const onFinish = async (values: SearchQuery) => {
    setOrigin(values.origin)
    setDestination(values.destination)
    setDepartureDate(values.departureDate)
    setAwardProgram(values.program)
  }

  const defaults: SearchQuery = {
    origin: "HNL",
    destination: "SFO",
    departureDate: today,
    program: "united",
  }

  return (
    <Form form={form} name="searchFields" initialValues={defaults} onFinish={onFinish} layout="inline">
      <Form.Item name="origin" style={{ width: 100 }}><Input prefix={<LogoutOutlined />} placeholder="Origin" /></Form.Item>
      <Form.Item name="destination" style={{ width: 100 }}><Input prefix={<LoginOutlined />} placeholder="Destination" /></Form.Item>
      <Form.Item name="departureDate">
        <DatePicker format="YYYY-MM-DD" />
      </Form.Item>
      <Form.Item name="program" style={{ width: 200 }}><Input prefix={<NodeIndexOutlined />} placeholder="Program" /></Form.Item>
      <Form.Item wrapperCol={{ offset: 2, span: 3 }}><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={isLoading}>Search</Button></Form.Item>
    </Form>
  )
}

