import pRetry from "p-retry"
import sqlite3 from "sqlite3"

export default class Db {
  private db?: sqlite3.Database

  public async close() {
    if (this.db)
      return new Promise((resolve, reject) => this.db?.close((err) => err ? reject(err) : resolve(undefined)))
  }

  public async init(filename: string) {
    sqlite3.verbose()
    this.db = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX)

    await pRetry(async () => {
      await new Promise((resolve, reject) => this.db!.run(
        "PRAGMA journal_mode=WAL", (err) => err ? reject(err) : resolve(undefined)))
      await new Promise((resolve, reject) => this.db!.run(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER)", (err) => err ? reject(err) : resolve(undefined)))
    }, { retries: 3 })
  }

  public async set(key: string, value: string, ttl: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
        [key, value, Date.now() + ttl], (err) => err ? reject(err) : resolve())
    })
  }

  async get(key: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      this.db!.get("SELECT value, expires_at FROM cache WHERE key = ? LIMIT 1", [key], (err, row: any) => {
        if (err) {
          reject(err)

        } else if (row && row.expires_at < Date.now()) {
          this.db!.run("DELETE FROM cache WHERE key = ?", [key], (err2) => err2 ? reject(err2) : resolve(undefined))

        } else {
          resolve(row ? row.value : undefined)
        }
      })
    })
  }
}
