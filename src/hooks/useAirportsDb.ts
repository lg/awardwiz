import * as React from "react"
import { firebaseFunctionsUrl } from "../helpers/firebase"
import type { Airport } from "../types/scrapers"

export const useAirportsDatabase = () => {
  const [ airports, setAirports ] = React.useState<Record<string, Airport>>({})

  React.useEffect(() => {
    void fetch(`${firebaseFunctionsUrl}/airports`)
      .then((resp) => resp.json())
      .then((data: Record<string, Airport>) => setAirports(data))
  }, [])

  return airports
}
