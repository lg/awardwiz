import { ArkalisCore } from "./arkalis.js"
import type { Protocol } from "devtools-protocol"
import c from "ansi-colors"
import globToRegexp from "glob-to-regexp"

type CompletedRequest = {
  requestId: string,
  request?: Protocol.Network.Request,
  response?: Protocol.Network.Response,
  downloadedBytes: number,
  startTime?: number,
  endTime?: number,
  success: boolean,
  body?: string,
  responseType?: Protocol.Network.ResourceType
}
type CompletedRequestWithBody = CompletedRequest & { body: string }

export const arkalisRequests = (arkalis: ArkalisCore) => {
  type SubscriptionCompletedEvent = (request: CompletedRequest) => Promise<void>
  const subscriptions: SubscriptionCompletedEvent[] = []
  const requests: Record<string, CompletedRequest> = {}
  let lastResponseTime: number = Date.now()

  const initRequest = (requestId: string) => {
    if (!requests[requestId])
      requests[requestId] = { requestId: requestId, downloadedBytes: 0, success: false }
  }
  const responseEvent = (response: Protocol.Network.ResponseReceivedEvent | Protocol.Network.DataReceivedEvent | Protocol.Network.LoadingFinishedEvent | Protocol.Network.LoadingFailedEvent) => {
    lastResponseTime = Date.now()
    initRequest(response.requestId)
    if (response.timestamp)
      requests[response.requestId]!.endTime = response.timestamp
  }

  arkalis.client.Network.requestWillBeSent((request) => {
    initRequest(request.requestId)
    requests[request.requestId] = { ...requests[request.requestId]!, request: request.request, startTime: request.timestamp }
  })
  arkalis.client.Network.responseReceived((response) => {    // headers only
    responseEvent(response)
    requests[response.requestId]!.response = response.response
    if (!response.response.fromDiskCache)
      requests[response.requestId]!.downloadedBytes += response.response.encodedDataLength
    requests[response.requestId]!.responseType = response.type
  })
  arkalis.client.Network.dataReceived((response) => {
    responseEvent(response)
    requests[response.requestId]!.downloadedBytes += response.encodedDataLength
  })
  arkalis.client.Network.loadingFinished((response) => {
    responseEvent(response)
    requests[response.requestId]!.success = true
    void completedLoading(response.requestId)
  })
  arkalis.client.Network.loadingFailed((response) => {
    responseEvent(response)
    void completedLoading(response.requestId, response)
  })

  async function completedLoading(requestId: string, failedResponse?: Protocol.Network.LoadingFailedEvent) {
    const item = requests[requestId]!
    if (!requests[requestId]?.request?.method)
      return

    let status = c.red("???")
    if (item.response?.status) {
      status = c[item.response.status >= 400 ? "red" : item.response.status >= 300 ? "yellow" : "green"](item.response.status.toString())

    } else if (failedResponse) {
      status = c.red(failedResponse.blockedReason === "inspector" ? "BLK" : "ERR")
      if (failedResponse.blockedReason !== "inspector" && failedResponse.errorText !== "net::ERR_ABORTED")
        arkalis.log(c.red(`Request failed with ${failedResponse.errorText}: ${item.request?.url ?? "(unknown url)"}`))
    }

    const urlToShow = item.request!.url.startsWith("data:") ? `${item.request!.url.slice(0, 80)}...` : item.request!.url
    const line =
      `${status} ` +
      `${item.response?.fromDiskCache ? c.yellowBright("CACHE") : (Math.ceil(item.downloadedBytes / 1024).toString() + "kB").padStart(5, " ")} ` +
      `${item.request?.method.padEnd(4, " ").slice(0, 4) ?? "????"} ` +
      `${c.white(urlToShow)} ` +
      `${c.yellowBright(item.response?.headers["cache-control"] ?? item.response?.headers["Cache-Control"] ?? "")}`

    arkalis.debugOptions.showRequests && arkalis.log(line)

    // Skip loading a body since it's apparently an agressive call
    const skipBodyLoading =
      subscriptions.length === 0 ||
      ["Preflight", "Beacon", "Ping", "CSPViolationReport", "PluginResource", "Manifest"].includes(item.responseType ?? "") ||
      (Object.entries(item.response?.headers ?? {}).some(([key, value]) => key.toLowerCase() === "content-length" && parseInt(value) === 0)) ||
      [101, 204, 205, 304].includes(item.response?.status ?? 0) ||
      ["OPTIONS", "HEAD"].includes(item.request?.method ?? "")

    item.body = skipBodyLoading ? undefined : (await arkalis.client.Network.getResponseBody({ requestId: requestId }).catch(() => undefined))?.body
    for (const subscription of subscriptions)
      await subscription(item)
  }

  return {
    stats: () => {
      const totRequests = Object.values(requests).length
      const cacheHits = Object.values(requests).filter((request) => request.response?.fromDiskCache).length
      const cacheMisses = totRequests - cacheHits
      const bytes = Object.values(requests).reduce((bytes, request) => (bytes += request.downloadedBytes), 0)

      const summary = `${totRequests.toLocaleString()} reqs, ${cacheHits.toLocaleString()} hits, ${cacheMisses.toLocaleString()} misses, ${bytes.toLocaleString()} bytes`
      return { totRequests, cacheHits, cacheMisses, bytes, summary }
    },
    getLastResponseTime: () => lastResponseTime,

    subscribeToUrl: (url: string | RegExp, onCompleted: (completedRequest: CompletedRequestWithBody) => Promise<void>) => {
      const urlRegexp = typeof url === "string" ? globToRegexp(url, { extended: true }) : url

      const removeSubscription = () => subscriptions.splice(subscriptions.indexOf(checkUrl), 1)
      const checkUrl = async (request: CompletedRequest) => {
        if (request.request?.url && urlRegexp.test(request.request.url) && request.body) {  // we expect some data in the body
          removeSubscription()
          await onCompleted(request as CompletedRequestWithBody)
        }
      }
      subscriptions.push(checkUrl)
      return removeSubscription   // call to unsubscribe
    }
  }
}
