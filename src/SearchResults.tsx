import * as React from "react"

import { Table, Tag } from "antd"
import { ColumnsType, ColumnType } from "antd/lib/table"
import * as moment from "moment"
import { FlightFare, FlightWithFares } from "./scrapers"

export const SearchResults = ({ results }: { results?: FlightWithFares[] }) => {
  const lowestFare = (fares: FlightFare[], cabin: string): FlightFare | null => {
    const faresForClass = fares?.filter((fare) => fare.cabin === cabin)
    if (!faresForClass || faresForClass.length === 0)
      return null
    return faresForClass.reduce((smallest, cur) => (cur.miles < smallest.miles ? cur : smallest))
  }

  const columns: ColumnsType<FlightWithFares> = [
    {
      title: "Flight",
      dataIndex: "flightNo",
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => recordA.flightNo.localeCompare(recordB.flightNo),
      width: 100
    },
    {
      title: "Origin",
      dataIndex: "origin",
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => recordA.origin.localeCompare(recordB.origin),
      width: 70
    },
    {
      title: "Departure",
      dataIndex: "departureDateTime",
      render: (departureDateTime: string) => moment(departureDateTime).format("M/D h:mm A"),
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => moment(recordA.departureDateTime).diff(moment(recordB.departureDateTime)),
      width: 130
    },
    {
      title: "Arrival",
      dataIndex: "arrivalDateTime",
      render: (arrivalDateTime: string) => moment(arrivalDateTime).format("M/D h:mm A"),
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => moment(recordA.arrivalDateTime).diff(moment(recordB.arrivalDateTime)),
      width: 130,
    },
    {
      title: "Destination",
      dataIndex: "destination",
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => recordA.destination.localeCompare(recordB.destination),
      width: 70
    },
    ...[{ title: "Economy", key: "economy" }, { title: "Business", key: "business" }, { title: "First", key: "first" }].map((column): ColumnType<FlightWithFares> => ({
      title: column.title,
      key: column.key,
      render: (record: FlightWithFares) => {
        const smallestFare = lowestFare(record.fares, column.key)
        if (!smallestFare)
          return ""

        const milesStr = smallestFare.miles.toLocaleString()
        const cashStr = smallestFare.cash.toLocaleString("en-US", { style: "currency", currency: smallestFare.currencyOfCash ?? "" })

        return <Tag color={smallestFare.isSaverFare ? "green" : "gold"}>{milesStr}{smallestFare.cash > 0 ? ` + ${cashStr}` : ""}</Tag>
      },
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => {
        const fareAMiles = lowestFare(recordA.fares, column.key)?.miles ?? Number.MAX_VALUE
        const fareBMiles = lowestFare(recordB.fares, column.key)?.miles ?? Number.MAX_VALUE
        return fareAMiles - fareBMiles
      },
      width: 70,
      align: "center"
    }))
  ]

  return (
    <Table dataSource={results} columns={columns} rowKey="flightNo" size="small" />
  )
}
