import { fromPlaywrightDetails, FiltersEngine, NetworkFilter } from "@cliqz/adblocker-playwright"
import { BrowserContext } from "playwright"
import fetch from "cross-fetch"
import { promises as fs } from "fs" // used for caching

export const enableBlockingForContext = async (context: BrowserContext, extraUrls?: string[], showBlocked: boolean = false) => {
  const adblockCache = { path: "tmp/adblocker.bin", read: fs.readFile, write: fs.writeFile }
  const engine = await FiltersEngine.fromLists(fetch, [
    "https://easylist.to/easylist/easylist.txt", "https://easylist.to/easylist/easyprivacy.txt", "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
    "https://easylist.to/easylist/fanboy-social.txt", "https://secure.fanboy.co.nz/fanboy-annoyance.txt", "https://easylist.to/easylist/easylist.txt",
    "https://cdn.jsdelivr.net/gh/badmojr/1Hosts@master/Xtra/adblock.txt"
   ], undefined, adblockCache )

  engine.update({ newNetworkFilters: extraUrls?.map((url) => NetworkFilter.parse(url)!) })

  await context.route("**/*", route => {
    const adblockReq = fromPlaywrightDetails(route.request())
    const engineMatch = engine.match(adblockReq)
    if (engineMatch.match) {
      if (showBlocked) console.log("\x1b[37mBLOCKING: ", route.request().url(), "\x1b[0m")
      return route.abort()
    }
    return route.fallback()
  })
}
