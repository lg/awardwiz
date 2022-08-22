import * as React from "react"
import { Button, DatePicker, Form } from "antd"
import { SearchQuery } from "../types/scrapers"
import moment_, { Moment } from "moment"
import { LeftOutlined, LoadingOutlined, RightOutlined, SearchOutlined, SwapOutlined } from "@ant-design/icons"
import { SelectAirport } from "./SelectAirport"

const moment = moment_

type FlightSearchFormProps = {
  searchQuery: SearchQuery
  isSearching: boolean
  onSearchClick: (values: { origins: string[], destinations: string[], departureDate: Moment }) => void
}

export const FlightSearchForm = ({ searchQuery, isSearching, onSearchClick }: FlightSearchFormProps) => {
  const swapOriginsAndDestinations = () => form.setFieldsValue({ origins: form.getFieldValue("destinations"), destinations: form.getFieldValue("origins") })
  const addDay = (days: number) => form.setFieldsValue({ departureDate: moment(form.getFieldValue("departureDate")).add(days, "day") })

  const initialValuesWithMoment = { ...searchQuery, departureDate: moment(searchQuery.departureDate) }
  const [form] = Form.useForm()
  return (
    <Form form={form} initialValues={initialValuesWithMoment} layout="inline" onFinish={onSearchClick}>
      <Form.Item name="origins" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginRight: 5, marginBottom: 0 }}>
        <SelectAirport placeholder="Origins" />
      </Form.Item>
      <Button icon={<SwapOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={swapOriginsAndDestinations} />
      <Form.Item name="destinations" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginBottom: 0 }}>
        <SelectAirport placeholder="Destinations" />
      </Form.Item>

      <Form.Item name="departureDate" style={{ marginRight: 5 }}>
        <DatePicker disabledDate={(current) => current.isBefore(moment().subtract(1, "day"))} allowClear={false} />
      </Form.Item>
      <Button icon={<LeftOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => addDay(-1)} />
      <Button icon={<RightOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={() => addDay(1)} />

      <Form.Item wrapperCol={{ offset: 2, span: 3 }} style={{ marginLeft: 10 }}>
        <Button type="primary" onFocus={(e) => e.currentTarget.blur()} htmlType="submit" icon={isSearching ? <LoadingOutlined /> : <SearchOutlined />}>
          {isSearching ? "Stop" : "Search"}
        </Button>
      </Form.Item>
    </Form>
  )
}
