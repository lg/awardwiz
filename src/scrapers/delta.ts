// NOTE: you must run scraper in proper environment since Delta uses Akamai bot detection.
// if you do too many failed attempts, youll get banned for a while. wait it out or find a
// proxy server.

import { HTTPResponse } from "puppeteer"
import { FlightFare, FlightWithFares } from "../types/scrapers"
import { browserlessInit, gotoPage, log, processScraperFlowRules, Scraper, ScraperMetadata } from "./common"
import type { DeltaResponse } from "./samples/delta"

// Samples: AMS-DXB, JFK-AMS

const meta: ScraperMetadata = {
  name: "delta",
  blockUrls: ["dlt-beacon.dynatrace-managed.com", "p11.techlab-cdn.com"],
}

export const scraper: Scraper = async (page, query) => {
  await gotoPage(page, "https://www.delta.com/flight-search/book-a-flight")

  const formattedDate = `${query.departureDate.substring(5, 7)}/${query.departureDate.substring(8, 10)}/${query.departureDate.substring(0, 4)}`

  log("processing scraper flow")
  const andThen = (airportCode: string): any => ([{
    find: "#search_input",
    type: airportCode,
    andThen: [{
      find: ".airportLookup-list .airport-code",
      andWaitFor: "body:not([class*='modal-open'])",
      done: true,
    }, {
      find: "#resultStatus",
      andContainsText: "No search result",
      clickMethod: "dont-click",
      throw: "airport not found",
      reusable: true
    }]
  }])
  const ret = await processScraperFlowRules(page, [
    { find: "#fromAirportName span.airport-code.d-block", andThen: andThen(query.origin) },
    { find: "#toAirportName span.airport-code.d-block", andThen: andThen(query.destination) },
    { find: "select[name='selectTripType']", selectValue: "ONE_WAY" },
    { find: "#calDepartLabelCont",
      andWaitFor: ".dl-datepicker-calendar",
      andThen: [
        {
          find: `a[data-date^='${formattedDate}']`,
          clickMethod: "offset55",
          andWaitFor: `a[data-date^='${formattedDate}'][class*='dl-selected-date']`,
          andThen: [{ find: "button.donebutton", andWaitFor: "div[class*='calDispValueCont']:not([class*='open'])" }],
          done: true
        },
        { find: `span[data-date^='${formattedDate}']`, throw: "historical date" }, // a date in the past
        { find: "a[aria-label='Next']:not([class*='no-next'])", reusable: true }
      ]
    },
    { find: "#shopWithMiles" }
  ]).catch((e) => {
    if (e.message === "historical date" || e.message === "airport not found")
      return e.message
    throw e
  })

  if (ret === "historical date") {
    log("request was for a date in the past")
    return []
  }
  if (ret === "airport not found") {
    log("origin/destination airport not found")
    return []
  }

  const result = await processScraperFlowRules(page, [
    { find: "#btnSubmit" },
    { find: "#advance-search-global-err-msg", done: true },
    { find: "button.btn-primary-cta", done: true },
    { find: "td.selected .naText", done: true }
  ])

  if (result === "td.selected .naText") return []   // no results
  if (result === "#advance-search-global-err-msg") {
    const errorText = await page.$eval("#advance-search-global-err-msg", (el: any) => el.innerText)
    if (errorText.includes("no results were found for your search"))  // another way for no results
      return []
    if (errorText.includes("there is a problem with the flight date(s) you have requested"))  // usually a same-day search
      return []
    throw new Error(`#advance-search-global-err-msg: ${errorText}`)
  }

  const response = await page.waitForResponse((checkResponse: HTTPResponse) => {
    return checkResponse.url() === "https://www.delta.com/shop/ow/search" && checkResponse.request().method() === "POST"
  }, { timeout: 20000 })
  const raw = await response.json() as DeltaResponse

  const flightsWithFares: FlightWithFares[] = []
  if (raw.itinerary.length > 0) {
    const flights = standardizeResults(raw)
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (raw: DeltaResponse) => {
  const results: FlightWithFares[] = []
  raw.itinerary.forEach((itinerary) => {
    const trip = itinerary.trip[0]

    const result: FlightWithFares = {
      departureDateTime: trip.schedDepartLocalTs.replace("T", " "),
      arrivalDateTime: trip.schedArrivalLocalTs.replace("T", " "),
      origin: trip.originAirportCode,
      destination: trip.destAirportCode,
      flightNo: `${trip.flightSegment[0].marketingCarrier.code} ${trip.flightSegment[0].marketingFlightNum}`,
      duration: trip.flightSegment[0].totalAirTime.day * 24 * 60 + trip.flightSegment[0].totalAirTime.hour * 60 + trip.flightSegment[0].totalAirTime.minute,
      aircraft: trip.flightSegment[0].flightLeg[0].aircraft.fleetName,
      fares: trip.viewSeatUrls[0].fareOffer.itineraryOfferList
        .filter((offer) => !offer.soldOut && offer.offered)
        .map((offer) => ({
          cash: offer.totalPrice?.currency?.amount ?? -1,
          currencyOfCash: offer.totalPrice?.currency?.code ?? "USD",
          miles: offer.totalPrice?.miles?.miles ?? 0,
          cabin: offer.brandInfoByFlightLegs[0].cos[0] === "O" ? "business" : "economy",
          scraper: "delta",
          bookingClass: offer.brandInfoByFlightLegs[0].cos
        }))
        .filter((fare) => fare.cash !== -1 && fare.miles !== 0)
        .reduce<FlightFare[]>((acc, fare) => {
          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, []),
      amenities: {
        hasPods: trip.summarizedProducts.some((product) => product.productIconId === "fla") || (trip.flightSegment[0].marketingCarrier.code === "DL" ? false : undefined),
        hasWiFi: trip.summarizedProducts.some((product) => product.productIconId === "wif") || (trip.flightSegment[0].marketingCarrier.code === "DL" ? false : undefined),
      }
    }

    if (itinerary.trip[0].flightSegment.length > 1)
      return
    if (itinerary.trip[0].originAirportCode !== raw.tripOriginAirportCode || itinerary.trip[0].destAirportCode !== raw.tripDestinationAirportCode)
      return

    results.push(result)
  })

  return results
}

module.exports = (params: any) => browserlessInit(meta, scraper, params)
