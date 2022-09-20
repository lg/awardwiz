import React from "react"
import * as ReactQuery from "@tanstack/react-query"
import { JsonViewer } from "@textea/json-viewer"
import { ScraperResponse } from "../types/scrapers"
import { Alert, Button, Tabs } from "antd"
import { default as dayjs, Dayjs } from "dayjs"

const { TabPane } = Tabs

type ScraperResultDetailsProps = {
  response: ScraperResponse | undefined
  queryKey: ReactQuery.QueryKey
}

export const ScraperResultDetails = ({ response, queryKey }: ScraperResultDetailsProps) => {
  const queryClient = ReactQuery.useQueryClient()
  const meta = queryClient.getQueryState<ScraperResponse, { message: string, log: string[]}>(queryKey)
  const rawLog = response?.log ?? meta?.error?.log ?? []

  let initialTime: Dayjs
  const logLines = rawLog.map((line, i) => {
    const parts = line.match(/^\[(.*, .+ (?:AM|PM)).*?\] (.*)$/)
    if (!parts || parts.length !== 3) return line
    if (i === 0) initialTime = dayjs(parts[1])

    return (
      <div key={line}>
        <span style={{ color: "red" }}>{dayjs(parts[1]).diff(initialTime, "seconds")}s </span>
        { parts[2].startsWith("*") ? <span style={{ color: "red" }}>{parts[2]}</span> : parts[2] }
        <br />
      </div>
    )
  })

  let log = <Alert showIcon message="Loading..." type="info" />
  if (logLines.length > 0)
    log = <pre style={{ fontSize: 10, height: "100%" }}>{logLines}</pre>

  let results = <Alert showIcon message="Loading..." type="info" />
  if (response) {
    // Custom CSS in src/index.css
    results = <JsonViewer
      value={response.flightsWithFares}
      enableClipboard={false}
      indentWidth={3}
      editable={false}
      rootName="flightsWithFares"
      className="flightswithfares-json-viewer"
    />
  } else if (meta?.error) {
    results = <Alert showIcon message={meta.error.message} type="error" />
  }

  const buttons = <Button style={{ marginLeft: 100 }} onClick={() => queryClient.resetQueries(queryKey)} size="small">Reload</Button>
  return (
    <Tabs tabBarExtraContent={buttons} size="small">
      <TabPane tab="Log" key="log">{log}</TabPane>
      <TabPane tab={`Results (${response?.flightsWithFares.length ?? 0})`} key="results">{results}</TabPane>
    </Tabs>
  )
}
