import * as React from "react"
import { Badge, ConfigProvider, Empty, Table, Tag } from "antd"
import { ColumnsType, ColumnType } from "antd/lib/table"
import moment_ from "moment"
import { FlightFare, FlightWithFares } from "../types/scrapers"
import MaterialSymbolsAirlineSeatFlat from "~icons/material-symbols/airline-seat-flat"
import MaterialSymbolsWifiRounded from "~icons/material-symbols/wifi-rounded"
import MdiAirplane from "~icons/mdi/airplane"
import { useCloudState } from "../hooks/useCloudState"
import awardwizImageUrl from "../wizard.png"
import { FastTooltip } from "./FastTooltip"
const moment = moment_

const triState = (condition: boolean | undefined, trueVal: string, falseVal: string, undefinedVal: string) => {
  if (condition === undefined)
    return undefinedVal
  return condition ? trueVal : falseVal
}

type MarkedFare = { flightNo: string, date: string, cabin: string }

export const SearchResults = ({ results, isLoading }: { results?: FlightWithFares[], isLoading: boolean }) => {
  const { value: markedFares, setValue: setMarkedFares } = useCloudState<MarkedFare[]>("markedFares", [])

  const lowestFare = (fares: FlightFare[], cabin: string): FlightFare | null => {
    const faresForClass = fares.filter((fare) => fare.cabin === cabin)
    if (faresForClass.length === 0)
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
    {
      title: "Amenities",
      render: (_text: string, flight) => (
        <>
          <FastTooltip title={flight.aircraft ?? "(Unknown aircraft)"}>
            <MdiAirplane style={{ verticalAlign: "middle", color: flight.aircraft ? "#000000" : "#dddddd" }} />
          </FastTooltip>
          <FastTooltip title={triState(flight.amenities.hasWiFi, "Has WiFi", "No WiFi", "WiFi unknown")}>
            <MaterialSymbolsWifiRounded style={{ verticalAlign: "middle", color: triState(flight.amenities.hasWiFi, "#000000", "#dddddd", "#ffffff"), paddingRight: 3, marginRight: 0 }} />
          </FastTooltip>
          <FastTooltip title={triState(flight.amenities.hasPods, "Has pods", "No pods", "Pods unknown")}>
            <MaterialSymbolsAirlineSeatFlat style={{ verticalAlign: "middle", color: triState(flight.amenities.hasPods, "#000000", "#dddddd", "#ffffff") }} />
          </FastTooltip>
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
    ...[{ title: "Economy", key: "economy" }, { title: "Business", key: "business" }, { title: "First", key: "first" }].filter((col) => results?.some((res) => res.fares.some((fare) => fare.cabin === col.key))).map((column): ColumnType<FlightWithFares> => ({
      title: column.title,
      key: column.key,
      render: (_, record) => renderFare(record, column.key),
      sorter: (recordA, recordB) => {
        const fareAMiles = lowestFare(recordA.fares, column.key)?.miles ?? Number.MAX_VALUE
        const fareBMiles = lowestFare(recordB.fares, column.key)?.miles ?? Number.MAX_VALUE
        return fareAMiles - fareBMiles
      },
    }))
  ]

  const renderFare = (record: FlightWithFares, cabin: string) => {
    const smallestFare = lowestFare(record.fares, cabin)
    if (!smallestFare)
      return ""

    const milesStr = Math.round(smallestFare.miles).toLocaleString()
    const cashStr = smallestFare.cash.toLocaleString("en-US", { style: "currency", currency: smallestFare.currencyOfCash, maximumFractionDigits: 0 })

    const tooltipContent = record.fares
      .filter((fare) => fare.cabin === cabin)
      .sort((a, b) => a.miles - b.miles)
      .map((fare) => <div key={`${fare.scraper}${record.flightNo}${fare.cabin}${fare.miles}`}>{fare.scraper}: {Math.round(fare.miles).toLocaleString()}{fare.isSaverFare ? ` (saver, ${fare.bookingClass ?? "?"})` : ` (${fare.bookingClass ?? "?"})`}</div>)

    const isSaverFare = record.fares.some((checkFare) => checkFare.isSaverFare && checkFare.cabin === cabin)

    const markedFare = (markedFares ?? []).find((check) => check.flightNo === record.flightNo && check.date.substring(0, 10) === record.departureDateTime.substring(0, 10) && check.cabin === cabin)
    const clickedFare = () => {
      if (markedFares === undefined) return     // if the user's prefs havent loaded yet, dont allow changes

      if (markedFare) {
        void setMarkedFares(markedFares.filter((fare) => fare !== markedFare))     // remove the marked fare
      } else {
        void setMarkedFares([...markedFares, { flightNo: record.flightNo, date: record.departureDateTime.substring(0, 10), cabin }])    // add the marked fare
      }
    }

    return (
      <FastTooltip title={tooltipContent}>
        <Badge dot={!!markedFare} offset={[-8, 0]} color="gold">
          <Tag color={isSaverFare ? "green" : "gold"} onClick={clickedFare} style={{ cursor: "pointer" }}>
            {milesStr}{` + ${cashStr}`}
          </Tag>
        </Badge>
      </FastTooltip>
    )
  }

  const emptyState = <Empty description="No flights" image={<img alt="empty" src={awardwizImageUrl} style={{ filter: "opacity(0.1)" }} />} />
  return (
    <ConfigProvider componentSize="small" renderEmpty={() => emptyState}>
      <Table<FlightWithFares>
        dataSource={results}
        columns={columns}
        rowKey={(record) => record.flightNo}
        loading={isLoading}
        showSorterTooltip={false}
        pagination={false}
        className="search-results"
        style={{ whiteSpace: "nowrap" }}
      />
    </ConfigProvider>
  )
}
