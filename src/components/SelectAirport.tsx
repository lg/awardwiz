import * as React from "react"
import { Select, Tag } from "antd"
import type { DefaultOptionType } from "antd/lib/select"
import airports from "../airports.json"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({ ...props }) => {
  const allAirports = React.useMemo(() => {
    const airportMap: { [key: string]: DefaultOptionType } = {}   // faster for deduplication
    airports.forEach((airport) => {
      if (airport.iata_code && airport.name && airport.iata_code.length === 3)
        airportMap[airport.iata_code] = { value: airport.iata_code, label: `${airport.iata_code} - ${airport.name}` }
    })
    return Object.values(airportMap)
  }, [])

  return (
    <Select
      mode="multiple"
      tagRender={SelectAirportTag}
      tokenSeparators={[",", " ", "/"]}
      options={allAirports}
      optionFilterProp="value"
      {...props}
    />
  )
}
