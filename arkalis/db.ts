import pRetry, { Options as PRetryOptions } from "p-retry"
import sqlite3 from "sqlite3"
sqlite3.verbose()

export default class ArkalisDb {
  private db!: sqlite3.Database

  private static retryOptions: PRetryOptions = {
    onFailedAttempt(error) {
      console.error(`Failed to use database: ${error.message} (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber})`)
    }
  }

  private constructor() {}
  public static async open(filename: string) {
    const db = new ArkalisDb()

    await pRetry(() => new Promise((resolve, reject) => {
      db.db = new sqlite3.Database(filename)
      db.db.on("open", () => resolve(undefined)).on("error", reject)
    }), ArkalisDb.retryOptions)
    db.db.configure("busyTimeout", 10000)

    await pRetry(() => new Promise((resolve, reject) =>
      db.db.run("PRAGMA journal_mode=WAL", (err) => err ? reject(err) : resolve(undefined))), ArkalisDb.retryOptions)
    await pRetry(() => new Promise((resolve, reject) =>
      db.db.run(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER)",
        (err) => err ? reject(err) : resolve(undefined)
      )
    ), ArkalisDb.retryOptions)

    return db
  }

  public async close() {
    return new Promise((resolve, reject) => this.db.close((err) => err ? reject(err) : resolve(undefined)))
  }

  public async set(key: string, value: string, ttl: number): Promise<void> {
    await pRetry(() => new Promise((resolve, reject) =>
      this.db.run(
        "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
        [key, value, Date.now() + ttl],
        (err) => err ? reject(err) : resolve(undefined)
      )
    ), ArkalisDb.retryOptions)
  }

  public async get(key: string): Promise<string | undefined> {
    const row: any = await pRetry(() => new Promise((resolve, reject) => {
      this.db.get("SELECT value, expires_at FROM cache WHERE key = ? LIMIT 1", [key], (err, gotRow: any) => err ? reject(err) : resolve(gotRow))
    }), ArkalisDb.retryOptions)

    // Check for and delete expired rows
    if (row && row.expires_at < Date.now()) {
      await pRetry(() => new Promise((resolve, reject) =>
        this.db.run("DELETE FROM cache WHERE key = ?", [key], (err) => err ? reject(err) : resolve(undefined))
      ), ArkalisDb.retryOptions)
      return undefined
    }

    return row ? row.value : undefined
  }
}
