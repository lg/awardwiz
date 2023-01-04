import { Scraper } from "./scraper.js"

export const enableStatsForContext = (sc: Scraper) => {
  const domains: Record<string, number> = {}

  sc.context.on("requestfinished", async (req) => {
    const response = await req.response()
    if (response?.headers()["x-fromcache"]) {
      sc.stats.totCacheHits += 1
    } else {
      sc.stats.totCacheMisses += 1

      const hostname = new URL(req.url()).hostname
      const sizes = await req.sizes()
      const bytes = sizes.responseBodySize + sizes.responseHeadersSize

      domains[hostname] = (domains[hostname] || 0) + bytes
      sc.stats.totDomains = Object.keys(domains).length
      sc.stats.bytesDownloaded += bytes
    }
  })

  sc.context.on("requestfailed", async request => {
    if (["NS_ERROR_FAILURE", "net::ERR_FAILED", "Blocked by Web Inspector"].includes(request.failure()?.errorText ?? ""))
    sc.stats.totBlocked += 1
  })
}
