import { Select, Tag } from "antd"
import React from "react"
import { Airport } from "../types/scrapers.js"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props["value"]}</Tag>

export const SelectAirport = ({ ...props }) => {
  const [airports, setAirports] = React.useState<Airport[]>([])
  React.useEffect(() => { void import("../airports.json").then((data) => { return setAirports(data.default)}) }, [])

  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={airports.map((airport) => ({ value: airport.iataCode, label: `${airport.iataCode} - ${airport.name}` }))}
        optionFilterProp="value"
        {...props}
      />
    </>
  )
}
