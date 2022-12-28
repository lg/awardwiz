import { commandOptions, createClient } from "@redis/client"
import { BrowserContext, Route } from "playwright"
import c from "ansi-colors"
import { default as globToRegexp } from "glob-to-regexp"
import { jsonParse } from "./common.js"

const MAX_CACHE_TIME_S = 3600 * 24

export const enableCacheForContext = async (context: BrowserContext, namespace: string, forceCache: string[], debug?: { showCached?: boolean, showUncached?: boolean }) => {
  const forceRegexps = forceCache.map((glob) => globToRegexp(glob, { extended: true }))

  const redis = createClient()
  redis.on("error", (err) => { console.log("Redis Client Error", err); return redis.disconnect() })
  await redis.connect()
  context.once("close", () => redis.disconnect())

  // This function is run when a previously cached route is requested
  const runCachedRoute = async (route: Route) => {
    if (route.request().method() !== "GET")
      return route.fallback()

    const cachedBodyBuffer = await redis.get(commandOptions({ returnBuffers: true }), `${namespace}:body:${route.request().url()}`)
    const cachedHeadersBuffer = await redis.get(commandOptions({ returnBuffers: true }), `${namespace}:headers:${route.request().url()}`)
    const cachedHeadersStr = cachedHeadersBuffer?.toString("utf8")
    if (!cachedBodyBuffer || !cachedHeadersStr) return route.fallback()

    if (debug?.showCached) console.log(">>", route.request().method(), route.request().url(), "\x1b[32mFROM CACHE\x1b[0m")
    return route.fulfill({ body: cachedBodyBuffer, headers: { ...jsonParse(cachedHeadersStr), "x-fromcache": "true" } })
  }

  context.on("response", async (response) => {
    if (await response.headerValue("x-fromcache") === "true")
      return

    const requestMethod = response.request().method()
    const cacheControl = await response.headerValue("cache-control")

    const maxAge = parseInt(/max-age=(?<maxAge>\d+)/u.exec(cacheControl ?? "")?.groups?.maxAge ?? "0")
    const isPublic = !!cacheControl?.includes("public")
    const isPrivate = !!cacheControl?.includes("private")
    const isNoCache = !!cacheControl?.includes("no-cache")

    const shouldCacheGlobally = maxAge > 0 && !isPrivate && !isNoCache
    const shouldCacheLocally = maxAge > 0 && !isPublic && !isNoCache
    const shouldCacheBecauseForced = forceRegexps.some((pattern) => pattern.test(response.url()))

    const shouldCache = (shouldCacheGlobally || shouldCacheLocally || shouldCacheBecauseForced) && requestMethod === "GET"
    if (shouldCache) {
      const body = await response.body().catch((e) => Buffer.from(""))
      await redis.setEx(`${namespace}:headers:${response.url()}`, Math.min(maxAge || MAX_CACHE_TIME_S, MAX_CACHE_TIME_S), Buffer.from(JSON.stringify(response.headers()), "utf-8"))
      await redis.setEx(`${namespace}:body:${response.url()}`, Math.min(maxAge || MAX_CACHE_TIME_S, MAX_CACHE_TIME_S), body)
      await context.route(response.url(), runCachedRoute)
    }

    if (debug?.showUncached)
      console.log(
        "<<",
        c.yellow(response.request().method()),
        c.yellow(response.status().toString()),
        response.url(),
        c.blue(await response.headerValue("cache-control") ?? "unknown"),
        c.green(shouldCache ? `ADDED TO CACHE ${shouldCacheBecauseForced ? "(FORCED)" : ""}` : ""))
  })

  const allKeys = await redis.keys(`${namespace}:*`)
  await Promise.all(allKeys.map((key) => {
    const url = key.substring(`${namespace}:headers:`.length)  // remove "cache:xyz:" prefix
    return context.route(url, runCachedRoute)
  }))
}
