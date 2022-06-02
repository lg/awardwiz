import * as React from "react"
import { Divider, Select, Tag } from "antd"
import { ReactElement } from "react"
import { AirportMap } from "./AirportMap"
import { useAirportsDb } from "../hooks/useAirportsDb"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({ ...props }) => {
  const airportsDb = useAirportsDb()

  const menu = (menuElement: ReactElement) => (
    <>
      {menuElement}
      <Divider style={{ margin: "8px 0" }} />
      <AirportMap airports={props.value} />
    </>
  )

  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={airportsDb.options}
        optionFilterProp="value"
        dropdownRender={menu}
        {...props}
      />
    </>
  )
}
