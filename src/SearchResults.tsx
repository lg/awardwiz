import * as React from "react"

import { Table, Tag } from "antd"
import { ColumnsType, ColumnType } from "antd/lib/table"

type Fare = {
  program: string,
  miles: number,
  cash: number,
  currency: string
  fareCode: string
}
type FlightRow = {
  key: string,
  flightNo: string,
  origin: string,
  destination: string,
  departureTimeUtc: Date,
  arrivalTimeUtc: Date
  fares: Fare[]
}

export const SearchResults = () => {
  const dataSource: FlightRow[] = [
    {
      key: "UA 1234",
      flightNo: "UA 1234",
      origin: "SFO",
      destination: "LIH",
      departureTimeUtc: new Date(Date.parse("2022/04/15 6:34 PM")),
      arrivalTimeUtc: new Date(Date.parse("2022/04/15 9:30 PM")),
      fares: [{
        program: "United",
        miles: 1234,
        cash: 2.33,
        currency: "USD",
        fareCode: "I"
      }] as Fare[],
    },
    {
      key: "UA 567",
      flightNo: "UA 567",
      origin: "OAK",
      destination: "LIH",
      departureTimeUtc: new Date(Date.parse("2022/04/15 1:12 PM")),
      arrivalTimeUtc: new Date(Date.parse("2022/04/15 6:22 PM")),
      fares: []
    }
  ]

  const convertDate = (date: Date) => {
    const monthDayStr = `${date.getMonth() + 1}/${date.getDate()}`
    const hour12hr = `${date.getHours() <= 12 ? date.getHours() : date.getHours() - 12}`
    const minutesPadded = `${date.getMinutes() < 10 ? "0" : ""}${date.getMinutes()}`
    const amPmStr = date.getHours() <= 12 ? "AM" : "PM"
    return `${monthDayStr} ${hour12hr}:${minutesPadded} ${amPmStr}`
  }

  const lowestFare = (fares: Fare[], fareCode: string): Fare | null => {
    const faresForClass = fares?.filter((fare) => fare.fareCode === fareCode)
    if (!faresForClass || faresForClass.length === 0)
      return null
    return faresForClass.reduce((smallest, cur) => (cur.miles < smallest.miles ? cur : smallest))
  }

  const columns: ColumnsType<FlightRow> = [
    {
      title: "Flight",
      dataIndex: "flightNo",
      sorter: (recordA: FlightRow, recordB: FlightRow) => recordA.flightNo.localeCompare(recordB.flightNo),
      width: 100
    },
    {
      title: "Origin",
      dataIndex: "origin",
      sorter: (recordA: FlightRow, recordB: FlightRow) => recordA.origin.localeCompare(recordB.origin),
      width: 70
    },
    {
      title: "Departure",
      dataIndex: "departureTimeUtc",
      render: (departureTimeUtc: Date) => convertDate(departureTimeUtc),
      sorter: (recordA: FlightRow, recordB: FlightRow) => recordA.departureTimeUtc.getTime() - recordB.departureTimeUtc.getTime(),
      width: 130
    },
    {
      title: "Arrival",
      dataIndex: "arrivalTimeUtc",
      render: (arrivalTimeUtc: Date) => convertDate(arrivalTimeUtc),
      sorter: (recordA: FlightRow, recordB: FlightRow) => recordA.arrivalTimeUtc.getTime() - recordB.arrivalTimeUtc.getTime(),
      width: 130,
    },
    {
      title: "Destination",
      dataIndex: "destination",
      sorter: (recordA: FlightRow, recordB: FlightRow) => recordA.destination.localeCompare(recordB.destination),
      width: 70
    },
    ...[{ title: "Economy", key: "economy", fareCode: "X" }, { title: "Business", key: "business", fareCode: "I" }, { title: "First", key: "first", fareCode: "O" }].map((column): ColumnType<FlightRow> => ({
      title: column.title,
      key: column.key,
      render: (record: FlightRow) => {
        const smallestFare = lowestFare(record.fares, column.fareCode)
        if (!smallestFare)
          return ""

        const milesStr = smallestFare.miles.toLocaleString()
        const cashStr = smallestFare.cash.toLocaleString("en-US", { style: "currency", currency: smallestFare.currency })

        return <Tag color="blue">{milesStr}{smallestFare.cash > 0 ? ` + ${cashStr}` : ""}</Tag>
      },
      sorter: (recordA: FlightRow, recordB: FlightRow) => {
        const fareAMiles = lowestFare(recordA.fares, column.fareCode)?.miles ?? Number.MAX_VALUE
        const fareBMiles = lowestFare(recordB.fares, column.fareCode)?.miles ?? Number.MAX_VALUE
        return fareAMiles - fareBMiles
      },
      width: 70,
      align: "center"
    }))
  ]

  return (
    <Table dataSource={dataSource} columns={columns} rowKey="flightNo" size="small" />
  )
}
