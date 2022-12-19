import { commandOptions, createClient } from "@redis/client"
import { BrowserContext, Route } from "playwright"

export const enableCacheForContext = async (context: BrowserContext, namespace: string, debug?: { showCached?: boolean, showUncached?: boolean }) => {
  const redis = createClient()
  redis.on("error", (err) => { console.log("Redis Client Error", err); return redis.disconnect() })
  await redis.connect()
  context.once("close", () => redis.disconnect())

  // This function is run when a previously cached route is requested
  const runCachedRoute = async (route: Route) => {
    if (route.request().method() !== "GET")
      return route.fallback()

    const cachedBody = await redis.get(commandOptions({ returnBuffers: true }), `${namespace}:${route.request().url()}`)
    if (!cachedBody) return route.fallback()

    if (debug?.showCached) console.log(">>", route.request().method(), route.request().url(), "\x1b[32mFROM CACHE\x1b[0m")
    return route.fulfill({ body: cachedBody, headers: { "x-fromcache": "true" } })
  }

  context.on("response", async (response) => {
    if (await response.headerValue("x-fromcache") === "true")
      return

    const requestMethod = response.request().method()
    const cacheControl = await response.headerValue("cache-control")

    const maxAge = parseInt(cacheControl?.match(/max-age=(\d+)/)?.[1] ?? "0")
    const isPublic = !!cacheControl?.includes("public")
    const isPrivate = !!cacheControl?.includes("private")
    const isNoCache = !!cacheControl?.includes("no-cache")

    const shouldCacheGlobally = maxAge > 0 && !isPrivate && !isNoCache
    const shouldCacheLocally = maxAge > 0 && !isPublic && !isNoCache

    const shouldCache = (shouldCacheGlobally || shouldCacheLocally) && requestMethod === "GET"
    if (shouldCache) {
      const body = await response.body().catch((e) => Buffer.from(""))
      await redis.setEx(`${namespace}:${response.url()}`, Math.min(maxAge, 3600 * 24), body)
      await context.route(response.url(), runCachedRoute)
    }

    if (debug?.showUncached)
      console.log("<<", response.status(), response.url(), `\x1b[31m${await response.headerValue("cache-control")}\x1b[0m`, `\x1b[32m${shouldCache ? "ADDED TO CACHE" : ""}\x1b[0m`)
  })

  const allKeys = await redis.keys(`${namespace}:*`)
  await Promise.all(allKeys.map((key) => {
    const url = key.substring(`${namespace}:`.length)  // remove "cache:xyz:" prefix
    return context.route(url, runCachedRoute)
  }))
}
