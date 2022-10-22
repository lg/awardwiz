import * as React from "react"
import { Select, Tag } from "antd"
import { useAirportsDatabase } from "../hooks/useAirportsDb"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({ ...props }) => {
  const airportsDatabase = useAirportsDatabase()

  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={airportsDatabase.options}
        optionFilterProp="value"
        {...props}
      />
    </>
  )
}
