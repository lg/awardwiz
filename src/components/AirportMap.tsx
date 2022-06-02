import * as React from "react"
import Map, { Marker } from "react-map-gl"
import PhAirplaneDuotone from "~icons/ph/airplane-duotone"
import { useAirportsDb } from "../hooks/useAirportsDb"
import "mapbox-gl/dist/mapbox-gl.css"
import haversine from "haversine"

export const AirportMap = ({ airports }: { airports: string[] }) => {
  const airportsDb = useAirportsDb()

  const markers = airports.map((airport: string) => {
    return (
      <Marker
        key={`marker-${airport}`}
        longitude={airportsDb.airports[airport].longitude}
        latitude={airportsDb.airports[airport].latitude}
        offset={[-5, 0]}
        anchor="left"
      >
        <PhAirplaneDuotone color="black" transform="rotate(45)" />
        {airport}
      </Marker>
    )
  })

  const minLongitude = airports.reduce((min, airport) => Math.min(min, airportsDb.airports[airport].longitude), 180)
  const maxLongitude = airports.reduce((max, airport) => Math.max(max, airportsDb.airports[airport].longitude), -180)
  const minLatitude = airports.reduce((min, airport) => Math.min(min, airportsDb.airports[airport].latitude), 90)
  const maxLatitude = airports.reduce((max, airport) => Math.max(max, airportsDb.airports[airport].latitude), -90)
  const center = [(minLongitude + maxLongitude) / 2, (minLatitude + maxLatitude) / 2]
  const distance = haversine({ latitude: minLatitude, longitude: minLongitude }, { latitude: maxLatitude, longitude: maxLongitude }, { unit: "mile" })

  const zoom = Math.min(7, Math.max(0, 12 - Math.log2(distance)))       // bigger = more zoomed in

  return (
    <Map
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
      mapStyle="mapbox://styles/larrygadea/cl36berk200cr14p6cbtgw1vi"
      attributionControl={false}
      longitude={center[0]}
      latitude={center[1]}
      zoom={zoom}
      dragPan={false}
      style={{ width: "100%", height: 150 }}
    >
      {markers}
    </Map>
  )
}
