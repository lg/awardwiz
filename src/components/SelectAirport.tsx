import * as React from "react"
import { Select, Tag } from "antd"
import { useAirportsDb } from "../hooks/useAirportsDb"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({ ...props }) => {
  const airportsDb = useAirportsDb()

  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={airportsDb.options}
        optionFilterProp="value"
        {...props}
      />
    </>
  )
}
