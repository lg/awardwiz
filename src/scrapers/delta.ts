// NOTE: you must run scraper in proper environment since Delta uses Akamai bot detection

import { HTTPResponse } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperFunc } from "../types/scrapers"
import { processScraperFlowRules } from "./common"
import type { DeltaResponse } from "./extra/delta"

// Samples: AMS-DXB, JFK-AMS

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  console.log("going to delta main page")
  await page.goto("https://www.delta.com/flight-search/book-a-flight")

  const formattedDate = `${query.departureDate.substring(5, 7)}/${query.departureDate.substring(8, 10)}/${query.departureDate.substring(0, 4)}`

  await processScraperFlowRules(page, [
    { find: "#fromAirportName span.airport-code.d-block", andThen: [{ find: "#search_input", type: query.origin, andThen: [{ find: ".airportLookup-list .airport-code", andWaitFor: "body:not([class*='modal-open'])" }] }] },
    { find: "#toAirportName span.airport-code.d-block", andThen: [{ find: "#search_input", type: query.destination, andThen: [{ find: ".airportLookup-list .airport-code", andWaitFor: "body:not([class*='modal-open'])" }] }] },
    { find: "select[name='selectTripType']", selectValue: "ONE_WAY" },
    { find: "#calDepartLabelCont", andWaitFor: ".dl-datepicker-calendar", andThen: [{ find: `a[data-date^='${formattedDate}']`, andWaitFor: `a[data-date^='${formattedDate}'][class*='dl-selected-date']`, andThen: [{ find: "button.donebutton", andWaitFor: "div[class*='calDispValueCont']:not([class*='open'])" }], done: true }, { find: "a[aria-label='Next']:not([class*='no-next'])", reusable: true }] },
    { find: "#shopWithMiles" }
  ])

  await processScraperFlowRules(page, [
    { find: "#btnSubmit" },
    { find: "#advance-search-global-err-msg", done: true },
    { find: "button.btn-primary-cta", done: true }
  ])

  const errorMsg = await page.$("#advance-search-global-err-msg")
  if (errorMsg) {
    const errorText = await errorMsg.evaluate((el: any) => el.innerText)
    if (errorText.includes("no results were found for your search"))
      return { data: { flightsWithFares: [] } }
    throw new Error(errorText)
  }

  const response = await page.waitForResponse((checkResponse: HTTPResponse) => {
    return checkResponse.url() === "https://www.delta.com/shop/ow/search" && checkResponse.request().method() === "POST"
  }, { timeout: 20000 })
  const raw = await response.json() as DeltaResponse

  const flightsWithFares: FlightWithFares[] = []
  if (raw.itinerary && raw.itinerary.length > 0) {
    const flights = standardizeResults(raw)
    flightsWithFares.push(...flights)
  }

  return { data: { flightsWithFares } }
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
        .filter((offer) => offer && offer.soldOut === false && offer.offered === true)
        .map((offer) => ({
          cash: offer.totalPrice?.currency?.amount || -1,
          currencyOfCash: offer.totalPrice?.currency?.code || "USD",
          miles: offer.totalPrice?.miles?.miles || 0,
          cabin: offer.brandInfoByFlightLegs[0].cos[0] === "O" ? "business" : "economy",
          scraper: "delta",
          bookingClass: offer.brandInfoByFlightLegs[0].cos
        }))
        .filter((fare) => fare.cash !== undefined && fare.cash !== -1 && fare.miles !== 0)
        .reduce((acc, fare) => {
          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, [] as FlightFare[]),
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

module.exports = scraper
