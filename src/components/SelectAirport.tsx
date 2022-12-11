import { Select, Tag } from "antd"
import { useAirportsDatabase } from "../hooks/useAirportsDb"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>

export const SelectAirport = ({ ...props }) => {
  const airports = useAirportsDatabase()

  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={Object.entries(airports).map(([code, airport]) => ({ value: airport.iata_code, label: `${airport.iata_code} - ${airport.name}` }))}
        optionFilterProp="value"
        {...props}
      />
    </>
  )
}
