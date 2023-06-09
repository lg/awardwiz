import { ArkalisCore } from "./arkalis.js"
import c from "ansi-colors"
import url from "node:url"
import type { Protocol } from "devtools-protocol"
import CDP from "chrome-remote-interface"

export const arkalisProxy = (arkalis: ArkalisCore): { proxy?: string, onAuthRequired?: typeof onAuthRequiredFunc } => {
  // load proxies from env variables
  const proxies = Object.keys(process.env).reduce<Record<string, string[]>>((acc, k) => {
    if (!k.startsWith("PROXY_ADDRESS_"))
      return acc
    const groupName = k.replace("PROXY_ADDRESS_", "").toLowerCase()
    acc[groupName] = (process.env[k] ?? "").split(",")
    return acc
  }, {})

  const proxiesForScraper = proxies[arkalis.scraperMeta.name] ?? proxies["default"]
  if (!arkalis.debugOptions.useProxy || !proxiesForScraper || proxiesForScraper.length === 0) {
    arkalis.warn("Not using proxy server!")
    return { proxy: undefined, onAuthRequired: undefined }
  }

  let proxyUrl = proxiesForScraper[Math.floor(Math.random() * proxiesForScraper.length)]!

  // if the format is `http://user:pass_country-UnitedStates_session-AAABBBCC@proxy.abcdef.io:31112`, roll the
  // proxy session id to get a new ip address
  // eslint-disable-next-line regexp/no-unused-capturing-group
  const dynamicProxy = /http.*:\/\/.+:(?<start>\S{16}_country-\S+_session-)(?<sess>\S{8})@/u.exec(proxyUrl)
  if (dynamicProxy)
    proxyUrl = proxyUrl.replace(dynamicProxy.groups!["sess"]!, Math.random().toString(36).slice(2).substring(0, 8))

  arkalis.debugOptions.timezone ??= process.env[`PROXY_TZ_${arkalis.scraperMeta.name.toUpperCase()}`] ?? process.env["PROXY_TZ_DEFAULT"] ?? null

  arkalis.log(c.magentaBright(`Using proxy server: ${url.parse(proxyUrl).host!} ${arkalis.debugOptions.timezone !== null ? `(${arkalis.debugOptions.timezone})` : ""}`))

  const onAuthRequiredFunc = (client: CDP.Client, authReq: Protocol.Fetch.AuthRequiredEvent) => {
    if (authReq.authChallenge.source !== "Proxy")
      return
    if (!proxyUrl)
      return
    const auth = url.parse(proxyUrl).auth

    void client.Fetch.continueWithAuth({
      requestId: authReq.requestId,
      authChallengeResponse: {
        response: "ProvideCredentials",
        username: auth!.split(":")[0],
        password: auth!.split(":")[1]
      }
    })
  }

  return { proxy: proxyUrl, onAuthRequired: onAuthRequiredFunc }
}
