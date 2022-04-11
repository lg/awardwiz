/* eslint-disable */
import { Alert, Card, Space, Table, Select, Tag } from "antd"
import * as React from "react"
import * as ReactQuery from "react-query"
import { QueryFunctionContext } from "react-query"
import { FR24ServesRoutes } from "./common"

type AirportOption = { label: string; value: string }
export const CarrierSearch = () => {
  const [allAirports, setAllAirports] = React.useState([] as AirportOption[])

  React.useEffect(() => {
    fetch("/airports.json")
      .then((resp) => resp.json() as Promise<Airport[]>)
      .then((resp) => {
        const airportMap: { [key: string]: AirportOption } = {}
        resp.forEach((airport) => {
          if (!airport.iata_code || !airport.name || airport.iata_code.length !== 3)
            return

          airportMap[airport.iata_code] = { value: airport.iata_code, label: `${airport.iata_code} - ${airport.name}` }
        })
        setAllAirports(Object.values(airportMap))
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

  const AirportSelectTag = ({ ...props }) =>
    <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

  const AirportSelect = ({ ...props }) => {
    return <Select
      style={{ width: '220px' }}
      loading={isLoading}
      mode="multiple"
      tagRender={AirportSelectTag}
      tokenSeparators={[",", " ", "/"]}
      options={allAirports}
      optionFilterProp="value"
      {...props}
    />
  }

  return (
    <Card style={{ width: 700 }} title={(
      <Space>
        Origin: <AirportSelect defaultValue={origins} onChange={setOrigins} />
        Destination: <AirportSelect defaultValue={destinations} onChange={setDestinations} />
      </Space>
    )}>
      { resultsRender }
    </Card>
  )
}
