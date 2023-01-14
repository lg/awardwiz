// WARNING: this delta scraper is getting detected too quickly, plus also it doesnt have edge cases implemented yet

import dayjs from "dayjs"
import { gotoPage } from "../common.js"
import { ScraperMetadata } from "../scraper.js"
import { AwardWizScraper, FlightFare, FlightWithFares } from "../types.js"
import { DeltaResponse } from "./samples/delta.js"
import c from "ansi-colors"

export const meta: ScraperMetadata = {
  name: "delta",
  forceCacheUrls: ["*/predictivetext/getPredictiveCities?code=*", "*/flight-search/getdevicetype", "*/custlogin/getDashBrdData.action",
    "*/databroker/bcdata.action"]
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  await gotoPage(sc, "https://www.delta.com/flight-search/book-a-flight", "load")

  const shopWithMiles = async () => {
    sc.log("selecting miles")
    await sc.page.locator("label").filter({ hasText: "Shop with Miles" }).click()
  }

  const oneWay = async () => {
    sc.log("selecting oneway")
    await sc.page.getByRole("combobox", { name: "Trip Type:, changes will reload the page" }).getByText("Round Trip").click()
    await sc.page.getByRole("option", { name: "One Way" }).click()
  }

  const origin = async () => {
    sc.log("selecting origin")
    await sc.page.getByRole("link", { name: "From Departure Airport or City Your Origin" }).click()
    await sc.page.getByRole("textbox", { name: "Origin City or Airport" }).fill(query.origin)
    const resultOrigin = await Promise.race([
      sc.page.getByRole("link", { name: new RegExp(`${query.origin} .+,\\s.*`, "g") }).click().then(() => "ok").catch(() => "not found"),
      sc.page.locator("#resultStatus").getByText("No search result").waitFor().then(() => "not found").catch(() => "not found")
    ])
    if (resultOrigin === "not found") { sc.log(c.yellow("WARN: origin not found")) ; return [] }
    return
  }

  const destination = async () => {
    sc.log("selecting destination")
    await sc.page.getByRole("link", { name: "To Destination Airport or City Your Destination" }).click()
    await sc.page.getByRole("textbox", { name: "Destination City or Airport" }).fill(query.destination)
    const resultDestination = await Promise.race([
      sc.page.getByRole("link", { name: new RegExp(`${query.destination} .+,\\s.*`, "g") }).click().then(() => "ok").catch(() => "not found"),
      sc.page.locator("#resultStatus").getByText("No search result").waitFor().then(() => "not found").catch(() => "not found")
    ])
    if (resultDestination === "not found") { sc.log(c.yellow("WARN: destination not found")) ; return [] }
    return
  }

  const selectDate = async () => {
    sc.log("selecting date")
    await sc.page.getByRole("button", { name: "Depart and Return Calendar Use enter to open" }).click()

    const formattedDate = dayjs(query.departureDate).format("D MMMM YYYY, dddd")
    let monthDate = dayjs()
    await sc.page.getByText(monthDate.format("MMMMYYYY")).waitFor()     // calendar should appear
    monthDate = monthDate.add(1, "month")
    await sc.page.getByText(monthDate.format("MMMMYYYY")).waitFor()     // should be instant

    while (!await sc.page.getByRole("link", { name: formattedDate }).waitFor({timeout: 100}).then(() => true).catch(() => false)) {
      await sc.page.getByRole("link", { name: "Next" }).click()
      monthDate = monthDate.add(1, "month")
      await sc.page.getByText(monthDate.format("MMMMYYYY")).waitFor()
    }
    await sc.page.getByRole("link", { name: formattedDate }).click()
    await sc.page.getByRole("button", { name: "done" }).click()
  }

  for (const step of [shopWithMiles, oneWay, origin, destination, selectDate].sort((a, b) => Math.random() - 0.5)) {
    const result = await step()
    if (Array.isArray(result)) return result
  }

  // submit and skip past interstitial page
  sc.log("submitting search")
  void sc.page.locator("#btnSubmit").first().click()    // async

  sc.log("waiting for interstitial page")
  const result = await Promise.race([
    sc.page.locator("td.selected .naText").waitFor().then(() => "no flights").catch((e: Error) => e.message),
    sc.page.getByRole("button", { name: "Continue" }).click().then(() => "ok").catch((e: Error) => e.message),
    sc.page.waitForResponse((resp) => (resp.url() === "https://www.delta.com/content/www/en_US/system-unavailable1.html")).then(() => "Pre-interstitial anti-botting").catch((e: Error) => e.message)
  ])
  if (result === "no flights")
    return []
  if (result !== "ok")
    throw new Error(result)

  // clicked the continue button on the interstitial page, now wait for search results
  sc.log("clicked Continue, waiting for search results")
  const result2 = await Promise.race([
    sc.page.waitForResponse((resp) => (resp.url() === "https://www.delta.com/shop/ow/search" && resp.request().method() === "POST")).then((resp) => resp).catch((e: Error) => e.message),
    sc.page.waitForResponse((resp) => (resp.url() === "https://www.delta.com/content/www/en_US/system-unavailable1.html")).then(() => "Search result anti-botting").catch((e: Error) => e.message),
    sc.page.getByRole("heading", { name: "BOOK A FLIGHT" }).waitFor().then(() => "Search result anti-botting").catch((e: Error) => e.message)
  ])
  if (typeof result2 === "string" || !result2.ok())
    throw new Error(typeof result2 === "string" ? result2 : "Search result anti-botting")

  sc.log("got results start")
  const searchResults = await result2.finished().then(() => result2.json()) as DeltaResponse
  sc.log("finished getting results, parsing")

  const flightsWithFares: FlightWithFares[] = []
  if (searchResults.itinerary.length > 0) {
    const flights = standardizeResults(searchResults)
    flightsWithFares.push(...flights)
  }

  return flightsWithFares
}

const standardizeResults = (raw: DeltaResponse) => {
  const results: FlightWithFares[] = []
  for (const itinerary of raw.itinerary) {
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
        .reduce<FlightFare[]>((bestForCabin, fare) => {
          const existing = bestForCabin.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return bestForCabin
          return [...bestForCabin.filter((check) => check.cabin !== fare.cabin), fare]
        }, []),
      amenities: {
        hasPods: trip.summarizedProducts.some((product) => product.productIconId === "fla") || (trip.flightSegment[0].marketingCarrier.code === "DL" ? false : undefined),
        hasWiFi: trip.summarizedProducts.some((product) => product.productIconId === "wif") || (trip.flightSegment[0].marketingCarrier.code === "DL" ? false : undefined),
      }
    }

    if (itinerary.trip[0].flightSegment.length > 1)
      continue
    if (itinerary.trip[0].originAirportCode !== raw.tripOriginAirportCode || itinerary.trip[0].destAirportCode !== raw.tripDestinationAirportCode)
      continue

    results.push(result)
  }

  return results
}
