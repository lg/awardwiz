/* eslint-disable */
import { SearchOutlined } from "@ant-design/icons"
import { Alert, Button, Card, Form, Input, InputRef, Space, Table } from "antd"
import * as React from "react"
import * as ReactQuery from "react-query"
import { FR24ServesRoutes } from "./common"

export const CarrierSearch = () => {
  const [origin, setOrigin] = React.useState("LIH")
  const [destination, setDestination] = React.useState("SFO")

  const { isLoading: isLoading1, error: error1, data: airlineNames } = ReactQuery.useQuery(["airlineNames"], ({ signal }) => {
    return fetch("/airlines.json", { signal }).then((resp) => resp.json()).then((arr: AirLabsAirlineName[]) => {
      return arr.reduce((result: {[key: string]: string}, item) => {
        result[item.iata_code] = item.name
        return result
      }, {})
    })
  })

  const { isLoading: isLoading2, error: error2, data: departures } = ReactQuery.useQuery(["routes", origin, destination], ({ signal }) => {
    return FR24ServesRoutes(origin, destination, signal)
  }, { enabled: !!airlineNames })

  const originObj = React.createRef<InputRef>()
  const destinationObj = React.createRef<InputRef>()

  const onEnterPress = () => {
    setOrigin(originObj.current!.input!.value.toUpperCase())
    setDestination(destinationObj.current!.input!.value.toUpperCase())
  }

  let results = null
  if (departures && departures.length > 0) {
    const columns = [
      {title: "Origin + Destination", render: (data: any) => `${data.origin} ➤ ${data.destination}`},
      {title: "Airline Code", dataIndex: "airlineCode"},
      {title: "Airline Name", dataIndex: "airlineName"}
    ]
    results = <Table dataSource={departures} columns={columns} size="small" pagination={false} />
  } else if (error1 || error2) {
    results = <Alert message={`An error occured: ${((error1 || error2) as Error).message}`} type="error" />
  } else if (departures && departures.length === 0) {
    results = <Alert message={`Carriers for ${origin} to ${destination} not found`} type="info" />
  }

  return (
    <Card style={{ width: 500 }} size="small" title={(
      <Space>
        <Input addonBefore="Carrier Search Origin" defaultValue={origin} ref={originObj} onPressEnter={onEnterPress} />
        <Input addonBefore="Destination" defaultValue={destination} ref={destinationObj} onPressEnter={onEnterPress} />
        <Button type="primary" icon={<SearchOutlined />} loading={isLoading1 || isLoading2} onClick={onEnterPress} />
      </Space>
    )}>
      { results }
    </Card>
  )
}
