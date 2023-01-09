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
      // randomly select browser
      const pickFromBrowsers = Array.isArray(meta.useBrowser) ? meta.useBrowser : (typeof meta.useBrowser === "string" ? [meta.useBrowser] : BROWSERS)
      const selectedBrowserName = pickFromBrowsers[Math.floor(Math.random() * pickFromBrowsers.length)]
      browserPool = this.browserPools[selectedBrowserName]

      sc = await browserPool.acquire()
      const attemptResult = await sc.runAttempt(scraper, meta, `${id}-${{"firefox": "ff", "chromium": "ch", "webkit": "wk"}[selectedBrowserName]}`)

      await browserPool.destroy(sc)
      return attemptResult

    }, { retries: (debugOptions.maxAttempts ?? MAX_ATTEMPTS) - 1, minTimeout: 0, maxTimeout: 0, async onFailedAttempt(error) {    // retrying
      if (debugOptions.pauseAfterError) {
        sc?.log(error)
        await sc?.pause()
      }
      sc?.log(c.yellow(`Failed to run scraper (attempt ${error.attemptNumber} of ${error.retriesLeft + error.attemptNumber}): ${error.message.split("\n")[0]}`))
      if (sc)
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
