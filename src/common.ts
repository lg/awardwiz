// eslint-disable-next-line import/no-unresolved
import { FR24SearchResult } from "./fr24"

export const browserlessFetch = (url: string, signal?: AbortSignal | null) => {
  const data = { code: "module.exports=async({page:a,context:b})=>{const{url:c}=b;await a.goto(c);const d=await a.content();const innerText = await a.evaluate(() => document.body.innerText);return{data:JSON.parse(innerText),type:\"application/json\"}};", context: { url } }
  return fetch("http://localhost:4000/function", { signal, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
}

export const FR24ServesRoutes = (origin: string, destination: string, signal?: AbortSignal | null) => {
  return browserlessFetch(`https://api.flightradar24.com/common/v1/search.json?query=default&origin=${origin}&destination=${destination}`, signal)
    .then(async (resp) => {
      const json = await resp.json() as FR24SearchResult
      if (!json.result.response.flight.data)
        return []

      return json.result.response.flight.data.map((item) => {
        return { origin: item.airport.origin.code.iata, destination: item.airport.destination.code.iata, airlineCode: item.airline.code.iata, airlineName: item.airline.name }
      }).filter((item, index, self) => self.findIndex((t) => t.origin === item.origin && t.destination === item.destination && t.airlineCode === item.airlineCode) === index)   // remove duplicates
    })
}
