import * as React from "react"
import { Table, Tag, Tooltip } from "antd"
import { ColumnsType, ColumnType } from "antd/lib/table"
import moment_ from "moment"
import { FlightFare, FlightWithFares } from "../types/scrapers"
import MaterialSymbolsAirlineSeatFlat from "~icons/material-symbols/airline-seat-flat"
import MaterialSymbolsWifiRounded from "~icons/material-symbols/wifi-rounded"
import MdiAirplane from "~icons/mdi/airplane"
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

  const airlineLogoUrl = (airlineCode: string) => {
    return airlineCode === "WN" ? "https://www.southwest.com/favicon.ico" : `https://www.gstatic.com/flights/airline_logos/35px/${airlineCode}.png`
  }

  const columns: ColumnsType<FlightWithFares> = [
    {
      title: "Flight",
      dataIndex: "flightNo",
      sorter: (recordA, recordB) => recordA.flightNo.localeCompare(recordB.flightNo),
      render: (flightNo: string, flight) => (
        <>
          <img style={{ height: 16, marginBottom: 3, borderRadius: 3 }} src={airlineLogoUrl(flightNo.substring(0, 2))} alt={flightNo.substring(0, 2)} />
          <span style={{ marginLeft: 8 }}>{flightNo}</span>
        </>
      )
    },
    { title: "Amenities",
      render: (_text: string, flight) => (
        <>
          <Tooltip title={flight.aircraft || "(Unknown aircraft)"} mouseEnterDelay={0} mouseLeaveDelay={0}>
            <MdiAirplane style={{ verticalAlign: "middle" }} />
          </Tooltip>
          <Tooltip title={triState(flight.amenities?.hasWiFi, "Has WiFi", "No WiFi", "WiFi unknown")} mouseEnterDelay={0} mouseLeaveDelay={0}>
            <MaterialSymbolsWifiRounded style={{ verticalAlign: "middle", color: triState(flight.amenities?.hasWiFi, "#000000", "#dddddd", "#ffffff"), paddingRight: 3, marginRight: 0 }} />
          </Tooltip>
          <Tooltip title={triState(flight.amenities?.hasPods, "Has pods", "No pods", "Pods unknown")} mouseEnterDelay={0} mouseLeaveDelay={0}>
            <MaterialSymbolsAirlineSeatFlat style={{ verticalAlign: "middle", color: triState(flight.amenities?.hasPods, "#000000", "#dddddd", "#ffffff") }} />
          </Tooltip>
        </>
      )
    },
    {
      title: "From",
      dataIndex: "origin",
      sorter: (recordA, recordB) => recordA.origin.localeCompare(recordB.origin),
    },
    {
      key: "departure",
      render: (_text: string, record) => moment(record.departureDateTime).format("M/D"),
    },
    {
      title: "Departure",
      dataIndex: "departureDateTime",
      render: (text: string) => moment(text).format("h:mm A"),
      sorter: (recordA, recordB) => moment(recordA.departureDateTime).diff(moment(recordB.departureDateTime)),
      defaultSortOrder: "ascend",
    },
    {
      title: "Arrival",
      dataIndex: "arrivalDateTime",
      render: (_text: string, record) => `${moment(record.arrivalDateTime).format("h:mm A")} ${moment(record.arrivalDateTime).isAfter(moment(record.departureDateTime), "day") ? " (+1)" : ""}`,
      sorter: (recordA, recordB) => moment(recordA.arrivalDateTime).diff(moment(recordB.arrivalDateTime)),
    },
    {
      title: "Dest",
      dataIndex: "destination",
      sorter: (recordA, recordB) => recordA.destination.localeCompare(recordB.destination),
    },
    ...[{ title: "Economy", key: "economy" }, { title: "Business", key: "business" }, { title: "First", key: "first" }].filter((col) => results?.some((res) => res.fares.some((fare) => fare.cabin === col?.key))).map((column): ColumnType<FlightWithFares> => ({
      title: column.title,
      key: column.key,
      render: (_text: string, record) => {
        const smallestFare = lowestFare(record.fares, column.key)
        if (!smallestFare)
          return ""

        const milesStr = Math.round(smallestFare.miles).toLocaleString()
        const cashStr = smallestFare.cash.toLocaleString("en-US", { style: "currency", currency: smallestFare.currencyOfCash ?? "", maximumFractionDigits: 0 })

        const tooltipContent = record.fares
          .filter((fare) => fare.cabin === column.key)
          .sort((a, b) => a.miles - b.miles)
          .map((fare) => <div key={`${fare.scraper}${record.flightNo}${fare.cabin}${fare.miles}`}>{fare.scraper}: {Math.round(fare.miles).toLocaleString()}{fare.isSaverFare ? ` (saver, ${fare.bookingClass || "?"})` : ` (${fare.bookingClass || "?"})`}</div>)

        const isSaverFare = record.fares.some((checkFare) => checkFare.isSaverFare && checkFare.cabin === column.key)
        return <Tooltip title={tooltipContent} mouseEnterDelay={0} mouseLeaveDelay={0}><Tag color={isSaverFare ? "green" : "gold"}>{milesStr}{` + ${cashStr}`}</Tag></Tooltip>
      },
      sorter: (recordA, recordB) => {
        const fareAMiles = lowestFare(recordA.fares, column.key)?.miles ?? Number.MAX_VALUE
        const fareBMiles = lowestFare(recordB.fares, column.key)?.miles ?? Number.MAX_VALUE
        return fareAMiles - fareBMiles
      },
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
      style={{ whiteSpace: "nowrap" }}
    />
  )
}
