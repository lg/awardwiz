import * as React from "react"
import { Table, Tag, Tooltip } from "antd"
import { ColumnsType, ColumnType } from "antd/lib/table"
import moment_ from "moment"
import { FlightFare, FlightWithFares } from "../types/scrapers"
import MaterialSymbolsAirlineSeatFlat from "~icons/material-symbols/airline-seat-flat"
const moment = moment_

const triState = (condition: boolean | undefined, trueVal: string, falseVal: string, undefinedVal: string) => {
  if (condition === undefined)
    return undefinedVal
  return condition ? trueVal : falseVal
}

export const SearchResults = ({ results, isLoading }: { results?: FlightWithFares[], isLoading: boolean }) => {
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
    },
    { title: "Amenities",
      render: (_text: string, record: FlightWithFares) => {
        return (
          <Tooltip title={triState(record.amenities?.hasPods, "Has pods", "Does not have pods", "Unknown if there are pods")}>
            <MaterialSymbolsAirlineSeatFlat style={{ color: triState(record.amenities?.hasPods, "#000000", "#dddddd", "#ffffff") }} />
          </Tooltip>
        )
      }
    },
    {
      title: "From",
      dataIndex: "origin",
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => recordA.origin.localeCompare(recordB.origin),
    },
    {
      key: "departure",
      render: (_text: string, record: FlightWithFares) => moment(record.departureDateTime).format("M/D"),
    },
    {
      title: "Departure",
      dataIndex: "departureDateTime",
      render: (text: string) => moment(text).format("h:mm A"),
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => moment(recordA.departureDateTime).diff(moment(recordB.departureDateTime)),
      defaultSortOrder: "ascend",
    },
    {
      title: "Arrival",
      dataIndex: "arrivalDateTime",
      render: (_text: string, record: FlightWithFares) => `${moment(record.arrivalDateTime).format("h:mm A")} ${moment(record.arrivalDateTime).isAfter(moment(record.departureDateTime), "day") ? " (+1)" : ""}`,
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => moment(recordA.arrivalDateTime).diff(moment(recordB.arrivalDateTime)),
    },
    {
      title: "Dest",
      dataIndex: "destination",
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => recordA.destination.localeCompare(recordB.destination),
    },
    ...[{ title: "Economy", key: "economy" }, { title: "Business", key: "business" }, { title: "First", key: "first" }].map((column): ColumnType<FlightWithFares> => ({
      title: column.title,
      key: column.key,
      render: (_text: string, record: FlightWithFares) => {
        const smallestFare = lowestFare(record.fares, column.key)
        if (!smallestFare)
          return ""

        const milesStr = smallestFare.miles.toLocaleString()
        const cashStr = smallestFare.cash.toLocaleString("en-US", { style: "currency", currency: smallestFare.currencyOfCash ?? "" })

        return <Tooltip title={smallestFare.scraper}><Tag color={smallestFare.isSaverFare ? "green" : "gold"}>{milesStr}{smallestFare.cash > 0 ? ` + ${cashStr}` : ""}</Tag></Tooltip>
      },
      sorter: (recordA: FlightWithFares, recordB: FlightWithFares) => {
        const fareAMiles = lowestFare(recordA.fares, column.key)?.miles ?? Number.MAX_VALUE
        const fareBMiles = lowestFare(recordB.fares, column.key)?.miles ?? Number.MAX_VALUE
        return fareAMiles - fareBMiles
      },
      align: "center",
    }))
  ]

  return (
    <Table<FlightWithFares>
      dataSource={results}
      columns={columns}
      rowKey={(record) => record.flightNo}
      size="small"
      loading={isLoading}
      showSorterTooltip={false}
      pagination={false}
      className="search-results"
    />
  )
}
