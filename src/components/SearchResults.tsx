import { Badge, ConfigProvider, Empty, Table, Tag } from "antd"
import { ColumnsType, ColumnType } from "antd/lib/table"
import { FlightFare, FlightWithFares } from "../types/scrapers"
import MaterialSymbolsAirlineSeatFlat from "~icons/material-symbols/airline-seat-flat"
import MaterialSymbolsWifiRounded from "~icons/material-symbols/wifi-rounded"
import MdiAirplane from "~icons/mdi/airplane"
import awardwizImageUrl from "../wizard.png"
import { FastTooltip } from "./FastTooltip"
import { default as dayjs } from "dayjs"
import * as Firestore from "firebase/firestore"
import { firebaseAuth, firestore } from "../helpers/firebase"
import React, { useState } from "react"

const triState = (condition: boolean | undefined, trueValue: string, falseValue: string, undefinedValue: string) => {
  if (condition === undefined)
    return undefinedValue
  return condition ? trueValue : falseValue
}

export type MarkedFare = { origin: string, destination: string, date: string, checkFlightNo: string, checkCabin: string, curAvailable: boolean | undefined } & { uid?: string, id?: string }

const lowestFare = (fares: FlightFare[], cabin: string): FlightFare | undefined => {
  const faresForClass = fares.filter((fare) => fare.cabin === cabin)
  if (faresForClass.length === 0)
    return undefined
  return faresForClass.reduce((smallest, currentFare) => (currentFare.miles < smallest.miles ? currentFare : smallest))
}

const airlineLogoUrl = (airlineCode: string) => {
  return airlineCode === "WN" ? "https://www.southwest.com/favicon.ico" : `https://www.gstatic.com/flights/airline_logos/35px/${airlineCode}.png`
}

export const SearchResults = ({ results, isLoading }: { results?: FlightWithFares[], isLoading: boolean }) => {
  const [markedFares, setMarkedFares] = useState<MarkedFare[]>([])

  React.useEffect(() => {
    const markedFaresQuery = Firestore.query(Firestore.collection(firestore, "marked_fares"), Firestore.where("uid", "==", firebaseAuth.currentUser?.uid))
    const unsubscribe = Firestore.onSnapshot(markedFaresQuery, (snapshot) => {
      setMarkedFares(snapshot.docs.map((curDoc) => ({ ...curDoc.data(), id: curDoc.id } as MarkedFare)))
    })
    return () => { unsubscribe() }
  }, [])

  const columns: ColumnsType<FlightWithFares> = [
    {
      title: "Flight",
      dataIndex: "flightNo",
      sorter: (recordA, recordB) => recordA.flightNo.localeCompare(recordB.flightNo),
      render: (flightNo: string, flight) => (
        <>
          <img style={{ height: 16, marginBottom: 3, borderRadius: 3 }} src={airlineLogoUrl(flightNo.slice(0, 2))} alt={flightNo.slice(0, 2)} />
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
      render: (_text: string, record) => dayjs(record.departureDateTime).format("M/D"),
    },
    {
      title: "Departure",
      dataIndex: "departureDateTime",
      render: (text: string) => dayjs(text).format("h:mm A"),
      sorter: (recordA, recordB) => dayjs(recordA.departureDateTime).diff(dayjs(recordB.departureDateTime)),
      defaultSortOrder: "ascend",
    },
    {
      title: "Arrival",
      dataIndex: "arrivalDateTime",
      render: (_text: string, record) => `${dayjs(record.arrivalDateTime).format("h:mm A")} ${dayjs(record.arrivalDateTime).isAfter(dayjs(record.departureDateTime), "day") ? " (+1)" : ""}`,
      sorter: (recordA, recordB) => dayjs(recordA.arrivalDateTime).diff(dayjs(recordB.arrivalDateTime)),
    },
    {
      title: "Dest",
      dataIndex: "destination",
      sorter: (recordA, recordB) => recordA.destination.localeCompare(recordB.destination),
    },
    ...[{ title: "Economy", key: "economy" }, { title: "Business", key: "business" }, { title: "First", key: "first" }].filter((col) => results?.some((searchResult) => searchResult.fares.some((fare) => fare.cabin === col.key))).map((column): ColumnType<FlightWithFares> => ({
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

    const milesText = Math.round(smallestFare.miles).toLocaleString()
    const cashText = smallestFare.cash.toLocaleString("en-US", { style: "currency", currency: smallestFare.currencyOfCash, maximumFractionDigits: 0 })

    const tooltipContent = record.fares
      .filter((fare) => fare.cabin === cabin)
      .sort((a, b) => a.miles - b.miles)
      .map((fare) => <div key={`${fare.scraper}${record.flightNo}${fare.cabin}${fare.miles}`}>{fare.scraper}: {Math.round(fare.miles).toLocaleString()}{fare.isSaverFare ? ` (saver, ${fare.bookingClass ?? "?"})` : ` (${fare.bookingClass ?? "?"})`}</div>)

    const isSaverFare = record.fares.some((checkFare) => checkFare.isSaverFare && checkFare.cabin === cabin)

    const existingMarkedFare = markedFares.find((check) =>
      check.checkFlightNo === record.flightNo &&
      check.date.slice(0, 10) === record.departureDateTime.slice(0, 10) &&
      check.checkCabin === cabin)

    const clickedFare = async () => {
      if (existingMarkedFare) {
        void Firestore.deleteDoc(Firestore.doc(firestore, `marked_fares/${existingMarkedFare.id}`))   // remove the marked fare

      } else {
        void Firestore.addDoc(Firestore.collection(firestore, "marked_fares"), {
          uid: firebaseAuth.currentUser?.uid,
          origin: record.origin,
          destination: record.destination,
          checkFlightNo: record.flightNo,
          date: record.departureDateTime.slice(0, 10),
          checkCabin: cabin,
          curAvailable: isSaverFare
        })
      }
    }

    return (
      <FastTooltip title={tooltipContent}>
        <Badge dot={!!existingMarkedFare} offset={[-8, 0]} color="gold">
          <Tag color={isSaverFare ? "green" : "gold"} onClick={clickedFare} style={{ cursor: "pointer" }}>
            {milesText}{` + ${cashText}`}
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
