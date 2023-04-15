import fs from "fs/promises"
import path from "path"
import fsSync from "fs"

class FileSystemCache {
  private static readonly keyRegex = /^[\w-]+$/u

  public constructor(private readonly basePath: string) {
    if (!fsSync.existsSync(basePath))
      fsSync.mkdirSync(basePath, { recursive: true })
  }

  public async cleanUpExpiredKeys(): Promise<void> {
    const files = await fs.readdir(this.basePath)
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(this.basePath, file)
        const content = await fs.readFile(filePath, "utf-8")
        const { expiration } = JSON.parse(content)

        if (expiration < Date.now())
          await fs.unlink(filePath)
      })
    )
  }

  public async set(key: string, value: any, ttlMs: number): Promise<void> {
    if (!FileSystemCache.keyRegex.test(key))
      throw new Error(`Invalid key: ${key}`)

    const expiration = Date.now() + ttlMs
    const content = JSON.stringify({ value, expiration })
    const filePath = path.join(this.basePath, key)

    await fs.writeFile(filePath, content)
  }

  public async get<T>(key: string): Promise<T | undefined> {
    if (!FileSystemCache.keyRegex.test(key))
      throw new Error(`Invalid key: ${key}`)

    const filePath = path.join(this.basePath, key)

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const { value, expiration } = JSON.parse(content)

      if (expiration >= Date.now())
        return value

      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code !== "ENOENT")
        throw error
    }

    return undefined
  }
}

export default FileSystemCache
