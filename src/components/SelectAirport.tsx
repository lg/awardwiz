import { Select, Tag } from "antd"
import { Airport } from "../types/scrapers"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({allAirports, placeholder}: {allAirports: Airport[], placeholder: string}) => {
  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={allAirports.map((airport) => ({ value: airport.iataCode, label: `${airport.iataCode} - ${airport.name}` }))}
        optionFilterProp="value"
        placeholder={placeholder}
      />
    </>
  )
}
