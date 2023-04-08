import type { Protocol } from "devtools-protocol"
import c from "ansi-colors"
import CDP from "chrome-remote-interface"

type Request = { requestId: string, request?: Protocol.Network.Request, response?: Protocol.Network.Response, downloadedBytes: number, startTime?: number, endTime?: number, success?: boolean }

export class Stats {
  public requests: Record<string, Request> = {}
  public lastResponseTime: number = Date.now()

  public constructor(private readonly client: CDP.Client, private readonly showRequests: boolean, private readonly log: (msg: string) => void) {
    client.Network.requestWillBeSent((request) => {
      if (!this.requests[request.requestId])
        this.requests[request.requestId] = { requestId: request.requestId, downloadedBytes: 0 }
      this.requests[request.requestId] = { ...this.requests[request.requestId]!, request: request.request, startTime: request.timestamp }
    })
    client.Network.responseReceived((response) => {    // headers only
      this.lastResponseTime = Date.now()
      if (!this.requests[response.requestId])
        this.requests[response.requestId] = { requestId: response.requestId, downloadedBytes: 0 }
      this.requests[response.requestId]!.response = response.response
      if (!response.response.fromDiskCache)
        this.requests[response.requestId]!.downloadedBytes = parseInt(response.response.headers["content-length"] ?? "0")
    })
    client.Network.loadingFinished((response) => {
      this.lastResponseTime = Date.now()
      if (!this.requests[response.requestId])
        this.requests[response.requestId] = { requestId: response.requestId, downloadedBytes: 0 }
      this.requests[response.requestId]!.endTime = response.timestamp
      this.requests[response.requestId]!.success = true
      this.completedLoading(response.requestId)
    })
    client.Network.loadingFailed((response) => {
      this.lastResponseTime = Date.now()
      if (!this.requests[response.requestId])
        this.requests[response.requestId] = { requestId: response.requestId, downloadedBytes: 0 }
      this.requests[response.requestId]!.endTime = response.timestamp
      this.requests[response.requestId]!.success = false
      this.completedLoading(response.requestId, response)
    })
  }

  private completedLoading(requestId: string, failedResponse?: Protocol.Network.LoadingFailedEvent) {
    const item = this.requests[requestId]!
    if (!this.requests[requestId]?.request?.method)
      return

    let status = c.red("???")
    if (item.response?.status) {
      status = c[item.response.status >= 400 ? "red" : item.response.status >= 300 ? "yellow" : "green"](item.response.status.toString())

    } else if (failedResponse) {
      status = c.red(failedResponse.blockedReason === "inspector" ? "BLK" : "ERR")
      if (failedResponse.blockedReason !== "inspector" && failedResponse.errorText !== "net::ERR_ABORTED")
        this.log(c.red(`Request failed with ${failedResponse.errorText}: ${item.request?.url}`))
    }

    const urlToShow = item.request!.url.startsWith("data:") ? `${item.request!.url.slice(0, 80)}...` : item.request!.url
    const line =
      `${status} ` +
      `${item.response?.fromDiskCache ? c.yellowBright("CACHE") : (Math.ceil(item.downloadedBytes / 1024).toString() + "kB").padStart(5, " ")} ` +
      `${item.request?.method.padEnd(4, " ").slice(0, 4)} ` +
      `${c.white(urlToShow)} ` +
      `${c.yellowBright(item.response?.headers["cache-control"] ?? "")}`

    this.showRequests && this.log(line)
  }

  public toString() {
    const totRequests = Object.values(this.requests).length
    const cacheHits = Object.values(this.requests).filter((request) => request.response?.fromDiskCache).length
    const cacheMisses = totRequests - cacheHits
    const bytes = Object.values(this.requests).reduce((bytes, request) => (bytes += request.downloadedBytes), 0)

    const summary = `${totRequests.toLocaleString()} reqs, ${cacheHits.toLocaleString()} hits, ${cacheMisses.toLocaleString()} misses, ${bytes.toLocaleString()} bytes`
    return { totRequests, cacheHits, cacheMisses, bytes, summary }
  }
}
