import { QueryKey } from "@tanstack/react-query"
import axios, { GenericAbortSignal } from "axios"
import { DatedRoute } from "../hooks/useAwardSearch"
import { ScraperResponse } from "../types/scrapers"

export const runScraper = async (scraperName: string, datedRoute: DatedRoute, queryKey: QueryKey, signal: GenericAbortSignal | undefined) => {
  return axios.get<ScraperResponse>(`${import.meta.env.VITE_SCRAPERS_URL}/run/${scraperName}-${datedRoute.origin}-${datedRoute.destination}-${datedRoute.departureDate}`, { signal })
}
