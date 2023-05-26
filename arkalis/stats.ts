import { ArkalisCore } from "./arkalis.js"
import type { Protocol } from "devtools-protocol"
import c from "ansi-colors"

type Request = { requestId: string, request?: Protocol.Network.Request, response?: Protocol.Network.Response, downloadedBytes: number, startTime?: number, endTime?: number, success: boolean }

export const arkalisStats = (arkalis: ArkalisCore) => {
  const requests: Record<string, Request> = {}
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
  })
  arkalis.client.Network.dataReceived((response) => {
    responseEvent(response)
    requests[response.requestId]!.downloadedBytes += response.encodedDataLength
  })
  arkalis.client.Network.loadingFinished((response) => {
    responseEvent(response)
    requests[response.requestId]!.success = true
    completedLoading(response.requestId)
  })
  arkalis.client.Network.loadingFailed((response) => {
    responseEvent(response)
    completedLoading(response.requestId, response)
  })

  function completedLoading(requestId: string, failedResponse?: Protocol.Network.LoadingFailedEvent) {
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
  }
}
