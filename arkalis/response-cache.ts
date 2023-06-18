import { ArkalisCore } from "./arkalis.js"
import fs from "fs/promises"
import path from "path"
import fsSync from "fs"

export const arkalisResponseCache = (arkalis: ArkalisCore) => {
  const cache = arkalis.debugOptions.globalCachePath !== null && fileSystemCache(arkalis.debugOptions.globalCachePath)
  const resultCacheTtlMs = arkalis.scraperMeta.resultCacheTtlMs ?? arkalis.debugOptions.defaultResultCacheTtl

  return {
    async runAndCache<T>(key: string, func: () => Promise<T>): Promise<T> {
      // Use a previously cached response if available
      if (cache && arkalis.debugOptions.useResultCache && resultCacheTtlMs > 0) {
        const existingCache = await cache.get<T>(key)
        if (existingCache) {
          arkalis.log(`Found and using cached result for ${key}`)
          return existingCache
        }
      }

      const result = await func()

      // Store the successful result into cache
      if (cache && arkalis.debugOptions.useResultCache && resultCacheTtlMs > 0)
        await cache.set(key, result, resultCacheTtlMs)

      return result
    }
  }
}

type CacheValue = {
  value: unknown
  expiration: number
}

const KEY_REGEX = /^[\w-]+$/u

const fileSystemCache = (basePath: string) => {
  if (!fsSync.existsSync(basePath))
    fsSync.mkdirSync(basePath, { recursive: true })

  const cleanUpExpiredKeys = async () => {
    const files = await fs.readdir(basePath)
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(basePath, file)
        const content = await fs.readFile(filePath, "utf-8")
        const { expiration } = JSON.parse(content) as CacheValue

        if (expiration < Date.now())
          await fs.unlink(filePath)
      })
    )
  }

  const set = async (key: string, value: unknown, ttlMs: number) => {
    if (!KEY_REGEX.test(key))
      throw new Error(`Invalid key: ${key}`)

    const expiration = Date.now() + ttlMs
    const content = JSON.stringify({ value, expiration })
    const filePath = path.join(basePath, key)

    await fs.writeFile(filePath, content)
  }

  const get = async <T>(key: string): Promise<T | undefined> => {
    if (!KEY_REGEX.test(key))
      throw new Error(`Invalid key: ${key}`)

    const filePath = path.join(basePath, key)

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const { value, expiration } = JSON.parse(content) as CacheValue

      if (expiration >= Date.now())
        return value as T

      await fs.unlink(filePath)
    } catch (error: any) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw error
    }

    return undefined
  }

  return { get, set, cleanUpExpiredKeys }
}
