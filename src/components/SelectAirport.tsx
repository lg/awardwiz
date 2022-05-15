import * as React from "react"
import { Divider, Select, Tag } from "antd"
import type { DefaultOptionType } from "antd/lib/select"
import airportsDb from "../airports.json"
import "mapbox-gl/dist/mapbox-gl.css"
import { ReactElement } from "react"
import Map, { Marker } from "react-map-gl"
import * as turf from "@turf/turf"
import PhAirplaneDuotone from "~icons/ph/airplane-duotone"

const SelectAirportTag = ({ ...props }) => <Tag style={{ marginRight: 3 }} {...props}>{props.value}</Tag>
type Unpacked<T> = T extends (infer U)[] ? U : T
type Airport = Unpacked<typeof airportsDb>

export const SelectAirport = ({ ...props }) => {
  const allAirports = React.useMemo(() => {
    const airportOptions: { [key: string]: DefaultOptionType } = {}   // faster for deduplication
    const airports: { [key: string]: Airport } = {}
    airportsDb.forEach((airport: Airport) => {
      if (airport.iata_code && airport.name && airport.iata_code.length === 3) {
        airportOptions[airport.iata_code] = { value: airport.iata_code, label: `${airport.iata_code} - ${airport.name}` }
        airports[airport.iata_code] = airport
      }
    })
    return { options: Object.values(airportOptions), airports }
  }, [])

  const markers: ReactElement[] = props.value.map((airport: string) => {
    return (
      <Marker
        key={`marker-${airport}`}
        longitude={allAirports.airports[airport].longitude}
        latitude={allAirports.airports[airport].latitude}
        offset={[-5, 0]}
        anchor="left"
      >
        <PhAirplaneDuotone color="black" transform="rotate(45)" />
        {airport}
      </Marker>
    )
  })

  const renderDropdown = (menu: ReactElement) => {
    const points = turf.points(props.value.map((airport: string) => [allAirports.airports[airport].longitude, allAirports.airports[airport].latitude]))
    const center = turf.center(points)
    const envelope = turf.envelope(points)
    const distance = turf.distance(turf.point([envelope.bbox![0], envelope.bbox![1]]), turf.point([envelope.bbox![2], envelope.bbox![3]]), { units: "miles" })
    const zoom = Math.min(7, Math.max(0, 12 - Math.log2(distance)))       // bigger = more zoomed in

    return (
      <>
        {menu}
        <Divider style={{ margin: "8px 0" }} />
        <Map
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
          mapStyle="mapbox://styles/larrygadea/cl36berk200cr14p6cbtgw1vi"
          attributionControl={false}
          longitude={center.geometry.coordinates[0]}
          latitude={center.geometry.coordinates[1]}
          zoom={zoom}
          dragPan={false}
          style={{ width: "100%", height: 150 }}
        >
          {markers}
        </Map>
      </>
    )
  }

  return (
    <>
      <Select
        mode="multiple"
        tagRender={SelectAirportTag}
        tokenSeparators={[",", " ", "/"]}
        options={allAirports.options}
        optionFilterProp="value"
        dropdownRender={renderDropdown}
        {...props}
      />
    </>
  )
}
