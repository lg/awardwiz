import { ProtocolProxyApi } from "devtools-protocol/types/protocol-proxy-api.js"
type CDPProtocol = ProtocolProxyApi.ProtocolApi & { close: () => void }

export type LGCDPClient = Awaited<ReturnType<typeof LGCDPClient>>
export const LGCDPClient = async (opts: { host: string, port: number }): Promise<CDPProtocol> => {
  // Connect and get the list of targets
  const url = `http://${opts.host}:${opts.port}/json/list`
  const targets = await fetch(url).then(async (x) => x.json()) as { webSocketDebuggerUrl: string, url: string }[]
  const blankTarget = targets.find((x) => x.url === "about:blank")
  if (!blankTarget)
    throw new Error("Couldn't find blank target")

  // Connect to the target
  const ws = new WebSocket(blankTarget.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", (x) => { resolve(undefined) }, { once: true })
    ws.addEventListener("error", (ev) => { debugger; reject(new Error("WebSocket error")) }, { once: true })
    ws.addEventListener("close", (x) => { x.wasClean ? resolve(undefined) : reject(new Error(`WebSocket error: ${x.reason}`)) })
  })

  type CDPSuccessData = { id: number, result: object }
  type CDPErrorData = { id: number, error: { code: number, message: string } }
  type CDPEventData = { method: string, params: object }
  type CDPData = CDPSuccessData | CDPErrorData | CDPEventData

  let lastCommandId = 0
  const commandCallbacks = new Map<number, (obj: CDPData) => void>()
  const eventCallbacks: Record<string, ((obj: object) => void)[]> = {}

  ws.addEventListener("message", (event: MessageEvent<string>) => {
    const data = JSON.parse(event.data) as CDPData
    if ("method" in data) {   // event
      for (const callback of eventCallbacks[data.method] ?? [])
        callback(data.params)
      return
    }

    const callback = commandCallbacks.get(data.id)
    if (!callback)
      throw new Error("Received CDP message that has no callback registered!")

    commandCallbacks.delete(data.id)
    callback(data)
  })

  const send = async (method: string, params: object | undefined) => {
    const id = ++lastCommandId
    const data = JSON.stringify({ id, method, params })
    const stack = new Error().stack

    const response = await new Promise<CDPData>((resolve) => {
      commandCallbacks.set(id, resolve)
      ws.send(data)
    })

    if ("error" in response && response.error.code !== -32000) {
      const error = new Error(`${method} received message: ${response.error.message}`)
      error.stack = stack
      throw error
    }
    return (response as CDPSuccessData).result
  }

  const registerEvent = (domain: string, eventName: string, callback: (params: object) => void) => {
    const event = `${domain}.${eventName}`
    if (!eventCallbacks[event])
      eventCallbacks[event] = []
    eventCallbacks[event]!.push(callback)
  }

  return new Proxy<CDPProtocol>({} as unknown as CDPProtocol, {
    get: (target, domain, receiver) => {
      // misc commands we want for LGCDPClient (unrelated to the CDP Protocol)
      if (domain === "close")
        return () => ws.close()

      return new Proxy({}, {
        get: (target2, method, receiver2) => async (params: object | string | undefined, eventCallback: (params: object) => void) => {
          if (method === "on") {
            registerEvent(domain as string, params as string, eventCallback)
            return

          } else {
            return send(`${domain.toString()}.${method.toString()}`, params as object | undefined)
          }
        }
      })
    }
  })
}
