import type { Protocol } from "devtools-protocol"
import CDP from "chrome-remote-interface"

export type InterceptAction = {
  action: "fulfill" | "continue" | "fail"
  dataObj?: object
} & (
  (Protocol.Fetch.FulfillRequestRequest | Protocol.Fetch.ContinueRequestRequest | Protocol.Fetch.FailRequestRequest) | Omit<Protocol.Fetch.FulfillRequestRequest, "requestId">
)

export class Intercept {
  private intercepts: { pattern: RegExp, type: "Request" | "Response", callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction }[] = []

  public constructor(private readonly client: CDP.Client, private readonly onAuthRequired?: (authReq: Protocol.Fetch.AuthRequiredEvent) => void) {}

  public async enable() {
    await this.client.Fetch.enable({ handleAuthRequests: !!this.onAuthRequired, patterns:
      [{ urlPattern: "*", requestStage: "Request" }, { urlPattern: "*", requestStage: "Response" }] })
    this.client.Fetch.requestPaused(this.onRequestPaused.bind(this))
    if (this.onAuthRequired)
      this.client.Fetch.authRequired(this.onAuthRequired)
  }

  public async disable() {
    this.intercepts = []
    await this.client.Fetch.disable()
  }

  public add(pattern: RegExp, type: "Request" | "Response", callback: (params: Protocol.Fetch.RequestPausedEvent) => InterceptAction) {
    this.intercepts.push({ pattern, type, callback })
  }

  // Called whenever a request/response is processed
  private async onRequestPaused(req: Protocol.Fetch.RequestPausedEvent) {
    for (const intercept of this.intercepts.filter(i => (req.responseStatusCode && i.type === "Response")
        || (!req.responseStatusCode && i.type === "Request"))) {
      if (intercept.pattern.test(req.request.url)) {
        const action = intercept.callback(req)
        if (action.action === "continue") {
          if (req.responseStatusCode) {
            return this.client.Fetch.continueResponse({ ...action, requestId: req.requestId } as Protocol.Fetch.ContinueResponseRequest)
          } else {
            if (action.dataObj)
              return this.client.Fetch.continueRequest({ ...action, requestId: req.requestId, postData: Buffer.from(JSON.stringify(action.dataObj)).toString("base64") } as Protocol.Fetch.ContinueRequestRequest)
            else
              return this.client.Fetch.continueRequest({ ...action, requestId: req.requestId } as Protocol.Fetch.ContinueRequestRequest)
          }

        } else if (action.action === "fulfill") {
          if (action.dataObj)
            return this.client.Fetch.fulfillRequest({ ...action, requestId: req.requestId, body: Buffer.from(JSON.stringify(action.dataObj)).toString("base64") } as Protocol.Fetch.FulfillRequestRequest)
          else
            return this.client.Fetch.fulfillRequest({ ...action, requestId: req.requestId } as Protocol.Fetch.FulfillRequestRequest)

        } else {
          return this.client.Fetch.failRequest({ ...action, requestId: req.requestId } as Protocol.Fetch.FailRequestRequest)
        }
      }
    }

    // No intercepts matched, continue as normal
    if (req.responseStatusCode)
      return this.client.Fetch.continueResponse({ requestId: req.requestId }).catch(() => {})
    else
      return this.client.Fetch.continueRequest({ requestId: req.requestId }).catch(() => {})
  }
}