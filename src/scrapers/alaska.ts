import { FlightFare, FlightWithFares, ScraperQuery } from "../types/scrapers"
import { browserlessInit, BrowserlessInput, gotoPage, log, Scraper, ScraperMetadata } from "./common"

const meta: ScraperMetadata = {
  name: "alaska",
  blockUrls: [
    "resource.alaskaair.net", "p2pcontent-fd-prod.azurefd.net",
    "geoservice.alaskaair.com"
  ],
}

export const scraper: Scraper = async (page, query) => {
  // warm the browser up
  await gotoPage(page, "https://m.alaskaair.com/shopping/?timeout=true", undefined, 10000)

  log("doing xhr")
  const htmlResponse = await page.evaluate(async (context: ScraperQuery) => {
    const options: RequestInit = {}
    options.headers = {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://m.alaskaair.com",
      "user-agent": navigator.userAgent
    }
    options.body = `CacheId=&ClientStateCode=CA&SaveFields.DepShldrSel=False&SaveFields.RetShldrSel=False&SaveFields.SelDepOptId=-1&SaveFields.SelDepFareCode=&SaveFields.SelRetOptId=-1&SaveFields.SelRetFareCode=&SearchFields.IsAwardBooking=true&SearchFields.IsAwardBooking=false&SearchFields.SearchType=OneWay&SearchFields.DepartureCity=${context.origin}&SearchFields.ArrivalCity=${context.destination}&SearchFields.DepartureDate=${context.departureDate}&SearchFields.ReturnDate=&SearchFields.NumberOfTravelers=1&SearchFields.PriceType=Lowest&SearchFields.UpgradeOption=none&SearchFields.DiscountCode=&DiscountCode=&SourcePage=Search&deals-link=&SearchFields.IsCalendar=false`
    options.method = "POST"

    const response = await fetch("https://m.alaskaair.com/shopping/flights", options)
    return response.text()
  }, query)

  if (htmlResponse.includes("div class=\"px-captcha-error-header\""))
    throw new Error("Perimeter-X captcha while loading xhr")
  if (htmlResponse.includes("There are no flights for the destination city.") || htmlResponse.includes("All flights are full. Please try selecting a different date."))
    return []

  if (!htmlResponse.includes("<title>Available Flights | Alaska Airlines Mobile</title>"))
    throw new Error(`Unexpected result: ${htmlResponse}`)

  log("parsing")
  await page.setContent(htmlResponse)
  const parsedResults = await page.$$eval(".optionList > li", (elements: Element[]) => {
    // @ts-expect-error
    const queryElement = (root: Element | Document, selector: string, getAttrib: string): string | undefined => root.querySelector(selector)?.[getAttrib]
    const queryElementMatch = (root: Element | Document, selector: string, getAttrib: string, match: RegExp): RegExpMatchArray | undefined => queryElement(root, selector, getAttrib)?.match(match) ?? undefined
    const zeroPad = (numberToPad: string | number) => (numberToPad.toString().length === 1 ? `0${numberToPad}` : numberToPad)
    const time12to24 = (time: string) => { const d = new Date(`1/1/2020 ${time}`); return `${zeroPad(d.getHours())}:${zeroPad(d.getMinutes())}` }
    const addToDate = (date: string, days: number) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0] }

    return elements.map((element): FlightWithFares | undefined => {
      const flightNo = queryElementMatch(element, ".optionHeaderFltNum", "innerText", /Flight (.+)/)?.[1]
      if (!flightNo)      // instead of a flight number, Alaska says "2 flights*" in this spot
        return undefined

      const airlineCode = queryElementMatch(element, ".optionHeader > img", "src", /logos\/partners\/airlines\/mow\/(\S\S)/)?.[1]
      const origin = queryElementMatch(element, ".optionDeparts .optionCityCode", "innerText", /(\S{3})/)?.[1]
      const destination = queryElementMatch(element, ".left .optionCityCode", "innerText", /(\S{3})/)?.[1]
      const detailsUrl = queryElementMatch(element, ".right .optionLink", "href", /(\S+)/)?.[1]

      const departureDate = queryElement(element.ownerDocument, "input[name='SearchFields.DepartureDate']", "value")
      const departureTime = queryElementMatch(element, ".optionDeparts .optionTime .b", "innerText", /(\d+?):(\d+?) (am|pm)/)
      const arrivalTime = queryElementMatch(element, ".left .optionTime .b", "innerText", /(\d+?):(\d+?) (am|pm)/)
      const addDays = queryElementMatch(element, ".left .optionTime .arrivalDaysDifferent", "innerText", /(\d+?) day/)

      if (!airlineCode || !origin || !destination || !departureDate || !departureTime || !arrivalTime || !detailsUrl)
        throw new Error(`Invalid data for flight number ${flightNo}!`)

      return {
        flightNo: `${airlineCode} ${flightNo}`,
        origin,
        destination,
        departureDateTime: `${departureDate} ${time12to24(departureTime[0])}:00`,
        arrivalDateTime: `${addDays ? addToDate(departureDate, Number.parseInt(addDays[1], 10)) : departureDate} ${time12to24(arrivalTime[0])}:00`,
        duration: 0,
        aircraft: undefined,
        amenities: {
          hasWiFi: undefined,         // TODO: switch to desktop version which does have the indicator (search LAX-LIH for an AA award with it)
          hasPods: undefined,
        },
        fares: Object.values(element.querySelectorAll(".fare-ctn div[style='display: block;']:not(.fareNotSelectedDisabled)")).map((fare) => {
          const milesAndCash = queryElementMatch(fare, ".farepriceaward", "innerText", /(.+?)k \+[\S\s]*\$(.+)/)
          const cabin = queryElementMatch(fare, ".farefam", "innerText", /(Main|Partner Business|First Class)/)?.[1]
          if (!milesAndCash || !cabin)
            throw new Error(`Invalid fare data for flight number ${flightNo}!`)

          const flightFare: FlightFare = {
            cash: Number.parseFloat(milesAndCash[2]),
            currencyOfCash: "USD",
            cabin: airlineCode === "AS" ? { Main: "economy", "First Class": "business" }[cabin]! : { Main: "economy", "Partner Business": "business", "First Class": "first" }[cabin]!,
            miles: Number.parseFloat(milesAndCash[1]) * 1000,
            bookingClass: undefined,          // TODO: get it from somewhere, can't find it
            scraper: "alaska"
          }
          return flightFare
        })
      }
    }).filter((flight) => !!flight)
  }) as FlightWithFares[] // weird this is required to cancel out the undefineds

  return parsedResults
}

module.exports = (input: BrowserlessInput) => browserlessInit(meta, scraper, input)
