import axios from "axios"
import * as ReactQuery from "react-query"
import { FR24SearchResult } from "../types/fr24"

export type QueryPairing = {origin: string, destination: string, departureDate: string}
export type ServingCarrier = { origin: string, destination: string, airlineCode?: string, airlineName?: string }

export const useServingCarriersQuery = (airportPairs: QueryPairing[], queryProgress: (origin: string, destination: string, statusText: string, isLoading: boolean) => void) => {
  const servingCarriersQueries = ReactQuery.useQueries(
    airportPairs.map((pairing) => {
      return {
        queryKey: ["servingCarriers", pairing.origin, pairing.destination],
        staleTime: 1000 * 60 * 5,
        retry: 1,
        queryFn: async () => {
          const startTime = Date.now()
          queryProgress(pairing.origin, pairing.destination, "Requesting serving carriers...", true)

          const postData = {
            code: "module.exports=async({page:a,context:b})=>{const{url:c}=b;await a.goto(c);const d=await a.content();const innerText = await a.evaluate(() => document.body.innerText);return{data:JSON.parse(innerText),type:\"application/json\"}};",
            context: { url: `https://api.flightradar24.com/common/v1/search.json?query=default&origin=${pairing.origin}&destination=${pairing.destination}` }
          }
          const { data } = await axios.post<FR24SearchResult>("http://localhost:4000/function", postData /*, { signal }*/)

          if (data.errors)
            throw new Error(`${data.errors.message} -- ${JSON.stringify(data.errors.errors)}`)
          if (!data.result.response.flight.data)
            return []

          const carriers = data.result.response.flight.data
            .map((item) => ({ origin: item.airport.origin.code.iata, destination: item.airport.destination.code.iata, airlineCode: item.airline?.code.iata, airlineName: item.airline?.name } as ServingCarrier))
            .filter((item, index, self) => self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)   // remove duplicates
            .filter((item) => item.airlineCode && item.airlineName)   // remove flights without sufficient data (usually private flights)
            .filter((item) => !["1I", "FX"].includes(item.airlineCode!))

          queryProgress(pairing.origin, pairing.destination, `Success after ${Date.now() - startTime}ms`, false)
          return carriers
        },
        onError: (err: Error) => queryProgress(pairing.origin, pairing.destination, `Error: ${err.message}`, false),
      }
    })
  )

  const servingCarriers = servingCarriersQueries
    .filter((item) => item.data)
    .map((item) => item.data)
    .flat() as ServingCarrier[]
  return JSON.stringify(servingCarriers)
}
