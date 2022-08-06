// this scraper is best run with a stealth-capable browser

import { HTTPResponse, Page } from "puppeteer"
import { FlightFare, FlightWithFares, ScraperFunc, ScraperQuery } from "../types/scrapers"
import { randomUserAgent, startScraper, finishScraper, waitFor, applyPageBlocks } from "./common"
import type { SkyScannerResponse } from "./samples/skyscanner"

const BLOCK_IN_URL: string[] = [  // substrings
  "images.skyscnr.com", "css.skyscnr.com", "b.px-cdn.net", "px-client.net", "slipstream.skyscanner.net"
]

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  await startScraper("skyscanner", page, query, { blockInUrl: BLOCK_IN_URL })

  const x = (["economy", "business", "first"] as string[]).map(async (cabin) => {
    return scrapeClass(page, query, cabin)
  })

  const flights: FlightWithFares[] = [];
  (await Promise.all(x)).flat().forEach((flight) => {
    const existingFlight = flights.find((f) => f.flightNo === flight.flightNo)
    if (!existingFlight) {
      flights.push(flight)
      return
    }

    flight.fares.forEach((fare) => {
      const existingCabinFare = existingFlight.fares.find((f) => f.cabin === fare.cabin)
      if (!existingCabinFare) {
        existingFlight.fares.push(fare)
        return
      }

      if (fare.cash < existingCabinFare.cash)
        existingCabinFare.cash = fare.cash
    })
  })

  return finishScraper("skyscanner", page, flights)
}

const scrapeClass = async (globalPage: Page, query: ScraperQuery, cabin: string): Promise<FlightWithFares[]> => {
  // This scrape is done in parallel, so create a new page
  const context = await globalPage.browser().createIncognitoBrowserContext()
  const page = await context.newPage()
  await page.setUserAgent(randomUserAgent())
  await applyPageBlocks(page, { blockInUrl: BLOCK_IN_URL })

  let latestFlights: FlightWithFares[] = []
  let receivedCaptcha = false
  page.on("response", async (response: HTTPResponse) => {
    if (response.url().startsWith("https://www.skyscanner.com/sttc/px/captcha-v2/index.html")) {
      if (!receivedCaptcha)
        console.log(`received captcha on ${cabin} cabin`)
      receivedCaptcha = true
    }

    if (response.url().startsWith("https://www.skyscanner.com/g/conductor/v1/fps3/search")) {
      const json: SkyScannerResponse = await response.json()
      latestFlights = standardizeFlights(json, cabin)
      console.log(`updated flights: ${latestFlights.length} (cabin: ${cabin})`)
    }
  })

  page.goto(`https://www.skyscanner.com/transport/flights/${query.origin.toLowerCase()}/${query.destination.toLowerCase()}/${query.departureDate.substring(2, 4)}${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}/?adults=1&adultsv2=1&cabinclass=${cabin}&children=0&childrenv2=&inboundaltsenabled=false&infants=0&outboundaltsenabled=false&preferdirects=true&ref=home&rtn=0`).catch(() => {})

  let raceDone = false
  const req = page.waitForResponse((checkResponse: HTTPResponse) => checkResponse.url().startsWith("https://www.skyscanner.com/slipstream/grp/v1/custom/public/acorn/funnel_events/clients.SearchResultsPage")).catch(() => {})
  const timeout = page.waitForTimeout(15000).catch(() => {})
  const captchaed = waitFor(() => {
    if (raceDone) return true
    if (receivedCaptcha) {
      raceDone = true
      console.log(`fast stopping due to captcha on cabin ${cabin}`)
    }
    return raceDone
  })

  await Promise.race([req, timeout, captchaed])    // note there's a catch() for all puppeteer requests, incl the page.goto
  raceDone = true

  if ((receivedCaptcha as boolean) && latestFlights.length === 0) {
    console.log(`Captcha prevented results for ${cabin} cabin. Trying again...`)
    return scrapeClass(globalPage, query, cabin)
  }

  await page.close().catch(() => {})
  await context.close().catch(() => {})

  console.log(`Settled cabin ${cabin} with ${latestFlights.length} flights.`)
  return latestFlights
}

const standardizeFlights = (json: SkyScannerResponse, cabin: string): FlightWithFares[] => {
  console.log(`total multi-hop itineraries: ${json.itineraries.length}`)

  return json.itineraries.map((itinerary) => {
    if (itinerary.leg_ids.length > 1)
      return undefined
    const leg = json.legs.find((checkLeg) => checkLeg.id === itinerary.leg_ids[0])
    if (!leg)
      throw new Error(`Leg not found: ${itinerary.leg_ids[0]}`)
    if (leg.segment_ids.length !== 1)     // no connections
      return undefined
    const segment = json.segments.find((checkSegment) => checkSegment.id === leg.segment_ids[0])
    if (!segment)
      throw new Error(`Segment not found: ${leg.segment_ids[0]}`)

    if (segment.marketing_carrier_id !== segment.operating_carrier_id)    // no codeshares
      return undefined

    if (!itinerary.pricing_options[0].items[0].fares[0])        // pricing hasn't come in yet
      return undefined

    const airlineCode = json.carriers.find((checkCarrier) => checkCarrier.id === segment.marketing_carrier_id)?.display_code
    const fareFamily = itinerary.pricing_options[0].items[0].fares[0].fare_family ?? ""

    let actualCabin = cabin
    if (cabin === "first") {
      if (fareFamily.match(/FIRSTORBUS|FIRSTBUSFR|BUSINESS-FIRST/)) {
        actualCabin = "business"
      } else if (airlineCode === "AS" || airlineCode === "HA") {
        // Alaska/Hawaiian don't have a real first class
        actualCabin = "business"
      } else if (airlineCode === "AA" && !fareFamily.match(/FLAGSHIP/)) {
        // On true 'first' AA flights, it's marked as 'flagship first'
        actualCabin = "business"
      } else {
        debugger
      }
    }

    return {
      departureDateTime: segment.departure.replace("T", " ").substring(0, 16),
      arrivalDateTime: segment.arrival.replace("T", " ").substring(0, 16),
      origin: json.places.find((checkPlace) => checkPlace.id === segment.origin_place_id && checkPlace.type === "Airport")?.display_code,
      destination: json.places.find((checkPlace) => checkPlace.id === segment.destination_place_id && checkPlace.type === "Airport")?.display_code,
      flightNo: `${airlineCode} ${segment.marketing_flight_number}`,
      duration: segment.duration,
      aircraft: undefined,
      amenities: {
        hasPods: undefined,
        hasWiFi: undefined
      },
      fares: itinerary.pricing_options
        .filter((pricingOption) => pricingOption.price.amount)
        .map((pricingOption): FlightFare => ({
          cash: pricingOption.price.amount,
          currencyOfCash: "USD",
          miles: 0,
          cabin: actualCabin,
          scraper: "skyscanner",
          bookingClass: pricingOption.items[0].fares[0].booking_code
        }))
        .reduce<FlightFare[]>((acc, fare) => {
          const existing = acc.find((check) => check.cabin === fare.cabin)
          if (existing && existing.miles < fare.miles)
            return acc
          return acc.filter((check) => check.cabin !== fare.cabin).concat([fare])
        }, [])
    } as FlightWithFares

  }).filter((flight): flight is FlightWithFares => !!flight)
}

module.exports = scraper
