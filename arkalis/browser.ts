import { ArkalisCore } from "./arkalis.js"
import pRetry from "p-retry"
import { LGCDPClient } from "./cdp.ts"

export const arkalisBrowser = async (arkalis: ArkalisCore) => {
  // connect to CDP instance
  const cdpOpts = { host: arkalis.debugOptions.browserConfig.host, port: arkalis.debugOptions.browserConfig.port } as const
  if (arkalis.debugOptions.browserDebug)
    arkalis.log("Waiting for Chrome to be ready on", cdpOpts)

  arkalis.client = await pRetry(async () => LGCDPClient(cdpOpts), {
    forever: true, minTimeout: 100, maxTimeout: 2000, maxRetryTime: 30000, onFailedAttempt(error) {
      arkalis.debugOptions.browserDebug && arkalis.log(`Couldn't connect to Chrome: ${error.message}`)
    }
  })
  arkalis.debugOptions.browserDebug && arkalis.log("Chrome ready")

  await arkalis.client.Network.enable({ maxTotalBufferSize: 1024 * 1204 * 100, maxResourceBufferSize: 1024 * 1204 * 50 })
  await arkalis.client.Page.enable()
  await arkalis.client.Runtime.enable()
  await arkalis.client.DOM.enable({})

  // timezone (set either by the caller or the proxy)
  if (arkalis.debugOptions.timezone)
    await arkalis.client.Emulation.setTimezoneOverride({ timezoneId: arkalis.debugOptions.timezone })

  // block requested URLs
  if (arkalis.scraperMeta.blockUrls.length > 0)
    await arkalis.client.Network.setBlockedURLs({ urls: arkalis.scraperMeta.blockUrls })

  return {
    close: () => {
      arkalis.debugOptions.browserDebug && arkalis.log("Closing cdp client")
      // for (const domain of [arkalis.client.Network, arkalis.client.Page, arkalis.client.Runtime, arkalis.client.DOM])
      //   await domain.disable().catch(() => {})
      // await arkalis.client.Browser.close().catch(() => {})
      arkalis.client.close()

      arkalis.log("Closed cdp client")
    }
  }
}
