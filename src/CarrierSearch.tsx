/* eslint-disable */
import { Alert, Card, Space, Table, Select } from "antd"
import * as React from "react"
import * as ReactQuery from "react-query"
import { QueryFunctionContext } from "react-query"
import { FR24ServesRoutes } from "./common"

export const CarrierSearch = () => {
  React.useEffect(() => {
    fetch("/airports.json")
      .then((resp) => resp.json() as Promise<Airport[]>)
      .then((resp) => {
        setAllAirports(resp.map((airport) => ({
          value: airport.iata_code,
          label: `${airport.iata_code} - ${airport.name}`
        })))
      })
  }, [])

  const [origins, setOrigins] = React.useState(["LIH"])
  const [destinations, setDestinations] = React.useState(["SFO"])

  const queries = ReactQuery.useQueries(
    origins.map(origin => {
      return destinations.map(destination => {
        return {
          queryKey: ["carrierSearch", origin, destination],
          queryFn: (context: QueryFunctionContext) => FR24ServesRoutes(origin, destination, context.signal)
        }
      })
    }).flatMap(x => x)
  )
  const departures = queries.filter(x => x.data).flatMap(x => x.data) as AirlineRoute[]
  const isLoading = queries.some(query => query.isLoading)
  const error = queries.find(query => query.isError)?.error

  let resultsRender = null
  if (departures && departures.length > 0) {
    const columns = [
      {title: "Origin + Destination", render: (data: any) => `${data.origin} ➤ ${data.destination}`},
      {title: "Airline Code", dataIndex: "airlineCode"},
      {title: "Airline Name", dataIndex: "airlineName"}
    ]
    resultsRender = <Table dataSource={departures} columns={columns} size="small" pagination={false} rowKey={(row) => `${row.origin}${row.destination}${row.airlineCode}`} />
  } else if (error) {
    resultsRender = <Alert message={`An error occured: ${(error as Error).message}`} type="error" />
  } else if (departures && departures.length === 0 && !isLoading) {
    resultsRender = <Alert message={`Carriers for ${origins.join("/")} to ${destinations.join("/")} not found`} type="warning" />
  } else {
    resultsRender = <Alert message="Loading..." type="info" />
  }

  return (
    <Card style={{ width: 700 }} size="small" title={(
      <Space>
        Origin: <Select mode="multiple" size="small" tokenSeparators={[",", " ", "/"]} style={{ width: '220px' }} defaultValue={origins} options={allAirports} onChange={(values) => setOrigins(values)} />
        Destination: <Select mode="multiple" size="small" tokenSeparators={[",", " ", "/"]} style={{ width: '220px' }} defaultValue={destinations} options={allAirports} onChange={(values) => setDestinations(values)} />
      </Space>
    )}>
      { resultsRender }
    </Card>
  )
}
