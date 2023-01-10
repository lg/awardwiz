import { AugmentedBrowserLauncher, chromium, firefox, webkit } from "playwright-extra"
import GenericPool from "generic-pool"
import { BrowserName, BROWSERS, DebugOptions, Scraper, ScraperMetadata } from "./scraper.js"
import { logGlobal } from "./log.js"
import c from "ansi-colors"
import pRetry from "p-retry"

export type ScraperResult<ReturnType> = {
  result: ReturnType | undefined
  logLines: string[]
}

export const NAV_WAIT_COMMIT_MS = 15000
const MAX_ATTEMPTS = 3

export class ScraperPool {
  browserPools: Record<BrowserName, GenericPool.Pool<Scraper>>

  browserFactory = (browserType: AugmentedBrowserLauncher, debugOptions: DebugOptions): GenericPool.Factory<Scraper> => ({
    create: async (): Promise<Scraper> => {
      const browser = new Scraper(browserType, debugOptions)
      await browser.create()
      return browser
    },
    destroy: async (scraperBrowser) => scraperBrowser.destroy()
  })

  constructor(private readonly debugOptions: DebugOptions = {}) {
    const browserPoolOpts: GenericPool.Options = {
      min: debugOptions.minBrowserPool ?? 2,
      max: debugOptions.maxBrowserPool ?? 3,
      autostart: true,
    }

    const genPool = (browserType: AugmentedBrowserLauncher) => {
      const pool = GenericPool.createPool<Scraper>(this.browserFactory(browserType, debugOptions), browserPoolOpts)
      pool.on("factoryCreateError", (err) => {
        logGlobal("factoryCreateError", err)
      })
      return pool
    }

    this.browserPools = { chromium: genPool(chromium), webkit: genPool(webkit), firefox: genPool(firefox) }
  }

  async runScraper<ReturnType>(scraper: (sc: Scraper) => Promise<ReturnType>, meta: ScraperMetadata, id: string): Promise<ScraperResult<ReturnType>> {
    const startTime = Date.now()
    let sc: Scraper | undefined
    const debugOptions = this.debugOptions
    let browserPool: GenericPool.Pool<Scraper> | undefined

    const scraperResult = await pRetry(async () => {
      // randomly select browser that's available yet compatible
      const compatibleBrowsers = meta.useBrowsers ? BROWSERS.filter(b => meta.useBrowsers!.includes(b)) : BROWSERS
      const availableBrowsers = compatibleBrowsers.filter(b => this.browserPools[b].available > 0)
      const possibleBrowsers = availableBrowsers.length > 0 ? availableBrowsers : compatibleBrowsers
      const selectedBrowserName = possibleBrowsers[Math.floor(Math.random() * possibleBrowsers.length)]
      if (availableBrowsers.length === 0)
        logGlobal(c.yellow(`No available browsers for scraper ${id}, need one of: [${compatibleBrowsers.join(", ")}], will wait...`))

      browserPool = this.browserPools[selectedBrowserName]

      sc = await browserPool.acquire()
      const attemptResult = await sc.runAttempt(scraper, meta, `${id}-${{"firefox": "ff", "chromium": "ch", "webkit": "wk"}[selectedBrowserName]}`)

      // as this was a successful run, do not destroy the browser/proxy
      await sc.release()
      await browserPool.release(sc)

      return attemptResult

    }, { retries: (debugOptions.maxAttempts ?? MAX_ATTEMPTS) - 1, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {    // retrying
      if (!sc) return
      if (debugOptions.pauseAfterError) {
        sc.log(error)
        await sc.pause()
      }
      sc.log(c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))
      await browserPool?.destroy(sc)    // we'll be getting a new browser for the next attempt

    }}).catch(async e => {    // failed all retries
      sc?.log(c.red(`Failed to run scraper: ${e.message}`))
      return undefined
    })

    if (sc)
      sc.log(`completed ${!scraperResult ? c.red("in failure ") : ""}in ${(Date.now() - startTime).toLocaleString("en-US")}ms (${sc.stats?.toString()})`)

    return { result: scraperResult, logLines: sc?.logLines ?? [] }
  }

  async drainAll() {
    await Promise.all(Object.values(this.browserPools).map(pool => pool.drain()))
    await Promise.all(Object.values(this.browserPools).map(pool => pool.clear()))
  }
}
