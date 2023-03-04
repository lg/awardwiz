import axios, { GenericAbortSignal } from "axios"
import { DatedRoute } from "../hooks/useAwardSearch"
import { ScraperResponse } from "../types/scrapers"

export const runScraper = async <T = ScraperResponse>(scraperName: string, datedRoute: DatedRoute, signal: GenericAbortSignal | undefined) => {
  return axios.get<T>(`${import.meta.env.VITE_SCRAPERS_URL}/run/${scraperName}-${datedRoute.origin}-${datedRoute.destination}-${datedRoute.departureDate}`, { signal })
}
