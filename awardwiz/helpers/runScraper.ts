import axios from "axios"
import type { GenericAbortSignal } from "axios"
import { DatedRoute } from "../hooks/useAwardSearch.js"
import { ScraperResponse } from "../types/scrapers.js"
import { firebaseAuth } from "../helpers/firebase.js"

export const runScraper = async <T = ScraperResponse>(scraperName: string, datedRoute: DatedRoute, signal: GenericAbortSignal | undefined) => {
  const token = import.meta.env.VITE_SCRAPERS_TOKEN ?? await firebaseAuth.currentUser?.getIdToken()
  if (!token)
    throw new Error("Missing token for scraper call")
  return axios.get<T>(`${import.meta.env.VITE_SCRAPERS_URL}/run/${scraperName}-${datedRoute.origin}-${datedRoute.destination}-${datedRoute.departureDate}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal
  })
}
