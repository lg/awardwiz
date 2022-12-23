import { BrowserContext } from "playwright"

export const enableStatsForContext = (context: BrowserContext) => {
  let totCacheHits = 0, totCacheMisses = 0, bytesDownloaded = 0, totBlocked = 0
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

  context.on("requestfailed", async request => {
    if (["NS_ERROR_FAILURE", "net::ERR_FAILED", "Blocked by Web Inspector"].includes(request.failure()?.errorText ?? ""))
     totBlocked += 1
  })

  return () => ({ totCacheHits, totCacheMisses, domains, bytesDownloaded, summary: `${totCacheHits} cache hits · ${totCacheMisses} cache misses · ${totBlocked} blocked · ${Object.keys(domains).length} domains · ${bytesDownloaded.toLocaleString("en-US")} bytes` })
}
