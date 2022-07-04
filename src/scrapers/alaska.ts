/* eslint-disable @typescript-eslint/ban-ts-comment */

import { FlightFare, FlightWithFares, ScraperCapabilities, ScraperFunc, ScraperQuery } from "../types/scrapers"

export const capabilities: ScraperCapabilities = {
  missingAttributes: ["duration"],
  missingFareAttributes: ["isSaverFare"]
}

export const scraper: ScraperFunc = async ({ page, context: query }) => {
  // warm the browser up
  await page.goto("https://m.alaskaair.com/shopping/?timeout=true")

  const htmlResponse = await page.evaluate(async (context: ScraperQuery) => {
    const options: RequestInit = {}
    options.headers = {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://m.alaskaair.com",
      referer: "https://m.alaskaair.com/shopping/?timeout=true",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36"
    }
    options.body = `CacheId=&ClientStateCode=CA&SaveFields.DepShldrSel=False&SaveFields.RetShldrSel=False&SaveFields.SelDepOptId=-1&SaveFields.SelDepFareCode=&SaveFields.SelRetOptId=-1&SaveFields.SelRetFareCode=&SearchFields.IsAwardBooking=true&SearchFields.IsAwardBooking=false&SearchFields.SearchType=OneWay&SearchFields.DepartureCity=${context.origin}&SearchFields.ArrivalCity=${context.destination}&SearchFields.DepartureDate=${context.departureDate}&SearchFields.ReturnDate=&SearchFields.NumberOfTravelers=1&SearchFields.PriceType=Lowest&SearchFields.UpgradeOption=none&SearchFields.DiscountCode=&DiscountCode=&SourcePage=Search&deals-link=&SearchFields.IsCalendar=false`
    options.method = "POST"

    const response = await fetch("https://m.alaskaair.com/shopping/flights", options)
    const text = response.text()

    return text

  }, query)

  await page.setContent(htmlResponse)
  const res = await page.$$eval(".optionList > li", (elements: Element[]) => {
    // @ts-ignore
    const queryEl = (rootEl: Element | Document, selector: string, getAttrib: string): string | undefined => rootEl.querySelector(selector)?.[getAttrib]
    const queryElMatch = (rootEl: Element | Document, selector: string, getAttrib: string, match: RegExp): RegExpMatchArray | undefined => queryEl(rootEl, selector, getAttrib)?.match(match) || undefined
    const zeroPad = (num: string | number) => (num.toString().length === 1 ? `0${num}` : num)
    const time12to24 = (time: string) => { const d = new Date(`1/1/2020 ${time}`); return `${zeroPad(d.getHours())}:${zeroPad(d.getMinutes())}` }
    const addToDate = (date: string, days: number) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0] }

    const flights = elements.map((element) => {
      const flightNo = queryElMatch(element, ".optionHeaderFltNum", "innerText", /Flight (.+)/)?.[1]
      if (!flightNo)      // instead of a flight number, Alaska says "2 flights*" in this spot
        return undefined

      const airlineCode = queryElMatch(element, ".optionHeader > img", "src", /logos\/partners\/airlines\/mow\/(\S\S)/)?.[1]
      const origin = queryElMatch(element, ".optionDeparts .optionCityCode", "innerText", /(\S\S\S)/)?.[1]
      const destination = queryElMatch(element, ".left .optionCityCode", "innerText", /(\S\S\S)/)?.[1]
      const detailsUrl = queryElMatch(element, ".right .optionLink", "href", /(\S+)/)?.[1]

      const departureDate = queryEl(element.ownerDocument, "input[name='SearchFields.DepartureDate']", "value")
      const departureTime = queryElMatch(element, ".optionDeparts .optionTime .b", "innerText", /(\d+?):(\d+?) (am|pm)/)
      const arrivalTime = queryElMatch(element, ".left .optionTime .b", "innerText", /(\d+?):(\d+?) (am|pm)/)
      const addDays = queryElMatch(element, ".left .optionTime .arrivalDaysDifferent", "innerText", /(\d+?) day/)

      if (!airlineCode || !origin || !destination || !departureDate || !departureTime || !arrivalTime || !detailsUrl)
        throw new Error(`Invalid data for flight number ${flightNo}!`)

      const flight: FlightWithFares = {
        flightNo: `${airlineCode} ${flightNo}`,
        origin,
        destination,
        departureDateTime: `${departureDate} ${time12to24(departureTime[0])}:00`,
        arrivalDateTime: `${addDays ? addToDate(departureDate, parseInt(addDays[1], 10)) : departureDate} ${time12to24(arrivalTime[0])}:00`,
        duration: undefined,    // missing if a partner flies it (ex. Operated by SkyWest Airlines as AlaskaSkyWest)
        aircraft: detailsUrl,           // filled in properly in the next step
        fares: Object.values(element.querySelectorAll(".fare-ctn div[style='display: block;']:not(.fareNotSelectedDisabled)")).map((fare) => {
          const milesAndCash = queryElMatch(fare, ".farepriceaward", "innerText", /(.+?)k \+[\s\S]*\$(.+)/)
          const cabin = queryElMatch(fare, ".farefam", "innerText", /(Main|Partner Business|First Class)/)?.[1]
          if (!milesAndCash || !cabin)
            throw new Error(`Invalid fare data for flight number ${flightNo}!`)

          const flightFare: FlightFare = {
            cash: parseFloat(milesAndCash[2]),
            currencyOfCash: "USD",
            cabin: airlineCode === "AS" ? { Main: "economy", "First Class": "business" }[cabin]! : { Main: "economy", "Partner Business": "business", "First Class": "first" }[cabin]!,
            miles: parseFloat(milesAndCash[1]) * 1000,
            isSaverFare: undefined,
            scraper: "alaska"
          }
          return flightFare
        }).filter((fare) => fare)
      }
      return flight
    }).filter((flight) => flight)
    return flights
  }) as FlightWithFares[] // weird this is required to cancel out the undefineds

  // Get the aircraft type for each flight from the details page
  const flights = await Promise.all(res.map(async (flight) => {
    await page.goto(flight.aircraft)    // should be a URL at this point
    const details = await page.$$eval(".detailinfo", (items: HTMLDivElement[]) => {
      return items.map((item) => item.textContent)
    })
    const aircraft = details[1].replace(/\n|\t|\r/g, "")
    return { ...flight, aircraft }
  }))

  return { data: { flightsWithFares: flights } }
}

module.exports = scraper
