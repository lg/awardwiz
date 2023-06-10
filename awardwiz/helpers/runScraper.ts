import axios, { GenericAbortSignal } from "axios"
import { DatedRoute } from "../hooks/useAwardSearch"
import { ScraperResponse } from "../types/scrapers"
import { firebaseAuth } from "../helpers/firebase"

export const runScraper = async <T = ScraperResponse>(scraperName: string, datedRoute: DatedRoute, signal: GenericAbortSignal | undefined) => {
  const token = import.meta.env.VITE_SCRAPERS_TOKEN ?? await firebaseAuth.currentUser?.getIdToken()
  return axios.get<T>(`${import.meta.env.VITE_SCRAPERS_URL}/run/${scraperName}-${datedRoute.origin}-${datedRoute.destination}-${datedRoute.departureDate}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal
  })
}
