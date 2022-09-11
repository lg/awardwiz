import * as React from "react"
import { Button, Form } from "antd"
import { SearchQuery } from "../types/scrapers"
import { LeftOutlined, LoadingOutlined, RightOutlined, SearchOutlined, SwapOutlined } from "@ant-design/icons"
import { SelectAirport } from "./SelectAirport"
import { default as dayjs, Dayjs } from "dayjs"
import DatePicker from "./DatePicker"

type FlightSearchFormProps = {
  searchQuery: SearchQuery
  isSearching: boolean
  onSearchClick: (values: { origins: string[], destinations: string[], departureDate: Dayjs }) => void
}

export const FlightSearchForm = ({ searchQuery, isSearching, onSearchClick }: FlightSearchFormProps) => {
  const swapOriginsAndDestinations = () => form.setFieldsValue({ origins: form.getFieldValue("destinations"), destinations: form.getFieldValue("origins") })
  const addDay = (days: number) => form.setFieldsValue({ departureDate: dayjs(form.getFieldValue("departureDate")).add(days, "day") })

  const initialValuesWithDate = { ...searchQuery, departureDate: dayjs(searchQuery.departureDate) }
  const [form] = Form.useForm()
  return (
    <Form form={form} initialValues={initialValuesWithDate} layout="inline" onFinish={onSearchClick}>
      <Form.Item name="origins" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginRight: 5, marginBottom: 0 }}>
        <SelectAirport placeholder="Origins" />
      </Form.Item>
      <Button icon={<SwapOutlined />} size="small" style={{ marginRight: 5, marginTop: 5 }} onClick={swapOriginsAndDestinations} />
      <Form.Item name="destinations" rules={[{ type: "array", min: 1 }]} style={{ width: 200, marginBottom: 0 }}>
        <SelectAirport placeholder="Destinations" />
      </Form.Item>

      <Form.Item name="departureDate" style={{ marginRight: 5 }}>
        <DatePicker disabledDate={(current) => current.isBefore(dayjs().subtract(1, "day"))} allowClear={false} />
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
