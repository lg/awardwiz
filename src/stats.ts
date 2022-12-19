import { BrowserContext } from "playwright"

export const enableStatsForContext = (context: BrowserContext) => {
  let totCacheHits = 0, totCacheMisses = 0, bytesDownloaded = 0
  const domains: Record<string, number> = {}

  context.on("response", async response => {
    if (await response.headerValue("x-fromcache")) {
      totCacheHits += 1
    } else {
      totCacheMisses += 1
      const hostname = new URL(response.url()).hostname
      const bytes = parseInt(await response.headerValue("content-length") ?? (await response.body().catch(e => Buffer.from(""))).byteLength.toString())
      domains[hostname] = (domains[hostname] || 0) + bytes
      bytesDownloaded += bytes
    }
  })

  return () => ({ totCacheHits, totCacheMisses, domains, bytesDownloaded, summary: `${totCacheHits} cache hits · ${totCacheMisses} cache misses · ${Object.keys(domains).length} domains · ${bytesDownloaded.toLocaleString("en-US")} bytes` })
}
