import * as React from "react"
import * as ReactQuery from "react-query"
import { Select, Tag } from "antd"
import axios from "axios"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({ ...props }) => {
  type AirportOption = { label: string; value: string }
  const { isLoading, data: allAirports } = ReactQuery.useQuery("airports", async ({ signal }) => {
    console.log("Getting airports")
    const { data: airports } = await axios.get<Airport[]>("/airports.json", { signal })

    const airportMap: { [key: string]: AirportOption } = {}   // faster for deduplication
    airports.forEach((airport) => {
      if (airport.iata_code && airport.name && airport.iata_code.length === 3)
        airportMap[airport.iata_code] = { value: airport.iata_code, label: `${airport.iata_code} - ${airport.name}` }
    })

    console.log("Got airports")
    return Object.values(airportMap)
  })

  return (
    <Select
      loading={isLoading}
      mode="multiple"
      tagRender={SelectAirportTag}
      tokenSeparators={[",", " ", "/"]}
      options={allAirports}
      optionFilterProp="value"
      {...props}
    />
  )
}
