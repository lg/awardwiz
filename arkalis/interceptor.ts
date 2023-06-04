import { Arkalis, ArkalisCore } from "./arkalis.js"
import type { Protocol } from "devtools-protocol"

type InterceptorReturn = "continue"
type InterceptorParams = Protocol.Fetch.RequestPausedEvent & { responseBody?: string, isResponse: boolean }
type Interceptor = (requestPausedEvent: InterceptorParams) => InterceptorReturn | Promise<InterceptorReturn>

export const arkalisInterceptor = (arkalis: ArkalisCore) => {
  const interceptors: Interceptor[] = []
  const onAuthReq = (arkalis as Arkalis).onAuthRequired

  void arkalis.client.Fetch.enable({ handleAuthRequests: !!onAuthReq }).then(() => {
    if (onAuthReq)
      void arkalis.client.Fetch.authRequired((authReq) => onAuthReq(arkalis.client, authReq))

    return arkalis.client.Fetch.requestPaused(async (requestPausedEvent) => {
      const isResponse = requestPausedEvent.responseStatusCode !== undefined || requestPausedEvent.responseErrorReason !== undefined
      const event: InterceptorParams = { ...requestPausedEvent, responseBody: undefined, isResponse }
      if (isResponse && interceptors.length > 0) {
        const responseBody = await arkalis.client.Fetch.getResponseBody({ requestId: requestPausedEvent.requestId })
        event.responseBody = responseBody.base64Encoded ? Buffer.from(responseBody.body, "base64").toString() : responseBody.body
      }

      // TODO: needs to be completed. united breaks the above, plus we're not handling different return types

      for (const interceptor of interceptors)
        await interceptor(event)
      return arkalis.client.Fetch.continueRequest({ requestId: requestPausedEvent.requestId, interceptResponse: true }).catch(() => {})
    })
  })

  return {
    addInterceptor: (interceptor: Interceptor) => {
      interceptors.push(interceptor)
    }
  }
}
