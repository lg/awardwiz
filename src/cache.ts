import { commandOptions, createClient } from "@redis/client"
import { Route, Response } from "playwright"
import c from "ansi-colors"
import { default as globToRegexp } from "glob-to-regexp"
import { jsonParse } from "./common.js"
import { Scraper } from "./scraper.js"

const MAX_CACHE_TIME_S = 3600 * 24

export class Cache {
  private redis = createClient({ url: process.env.REDIS_URL })
  private forceRegexps

  constructor(
    private sc: Scraper,
    private namespace: string,
    forceCache: string[],
    private debug: { showCached?: boolean, showUncached?: boolean, saveAfterCaching?: boolean }
  ) {
    this.forceRegexps = forceCache.map((glob) => globToRegexp(glob, { extended: true }))

    this.redis.on("error", (err) => {
      this.sc.log("Redis Client Error", err)
      return this.redis.disconnect()
    })
  }

  public async start() {
    if (!this.sc.context)
      throw new Error("No context")

    await this.redis.connect()

    // add all existing routes to cache
    const allKeys = await this.redis.keys(`${this.namespace}:*`)
    await Promise.all(allKeys.map((key) => {
      const url = key.substring(`${this.namespace}:headers:`.length)  // remove "cache:xyz:" prefix
      return this.sc.context?.route(url, this.runCachedRoute.bind(this))
    }))

    this.sc.context.on("response", this.onResponse.bind(this))
    this.sc.context.once("close", () => {
      return this.redis.disconnect()  // disconnect async
    })
  }

  private async runCachedRoute(route: Route) {
    if (route.request().method() !== "GET")
      return route.fallback()

    const cachedBodyBuffer = await this.redis.get(commandOptions({ returnBuffers: true }), `${this.namespace}:body:${route.request().url()}`)
    const cachedHeadersBuffer = await this.redis.get(commandOptions({ returnBuffers: true }), `${this.namespace}:headers:${route.request().url()}`)
    const cachedHeadersStr = cachedHeadersBuffer?.toString("utf8")
    if (!cachedBodyBuffer || !cachedHeadersStr) return route.fallback()

    if (this.debug.showCached)
      this.sc.log(">>", route.request().method(), route.request().url(), "\x1b[32mFROM CACHE\x1b[0m")
    return route.fulfill({ body: cachedBodyBuffer, headers: { ...jsonParse(cachedHeadersStr), "x-fromcache": "true" } })
  }

  private async onResponse(response: Response) {
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
    const shouldCacheBecauseForced = this.forceRegexps.some((pattern) => pattern.test(response.url()))

    let wasCached = false
    const shouldCache = (shouldCacheGlobally || shouldCacheLocally || shouldCacheBecauseForced) && requestMethod === "GET"
    if (shouldCache) {
      const body = await response.body().catch((e) => Buffer.from(""))
      if (body.length > 0) {
        await this.insertURLIntoCache(response.url(), body, Buffer.from(JSON.stringify(response.headers()), "utf-8"),
          Math.min(maxAge || MAX_CACHE_TIME_S, MAX_CACHE_TIME_S))
        wasCached = true
      }
    }

    if (this.debug.showUncached) {
      let debugText = ""
      if (shouldCache && wasCached) {
        debugText = c.green(`ADDED TO CACHE${shouldCacheBecauseForced ? " (FORCED)" : ""}`)
      } else if (shouldCache) {
        debugText = c.redBright("COULDNT CACHE")
      }

      this.sc.log("<<", c.yellow(response.request().method()), c.yellow(response.status().toString()), response.url(),
        c.blue(await response.headerValue("cache-control") ?? "unknown"), debugText)
    }
  }

  public async insertURLIntoCache(url: string, body: Buffer, headers: Buffer, ttl: number) {
    await this.redis.setEx(`${this.namespace}:headers:${url}`, ttl, headers)
    await this.redis.setEx(`${this.namespace}:body:${url}`, ttl, body)
    await this.sc.context?.route(url, this.runCachedRoute.bind(this))

    if (this.debug.saveAfterCaching)
      await this.redis.save()
  }
}
