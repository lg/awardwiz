import React from "react"
import * as ReactQuery from "@tanstack/react-query"
import ReactJson from "@textea/json-viewer"
import { ScraperResponse } from "../types/scrapers"
import { Button, Tabs } from "antd"
import moment_, { Moment } from "moment"
const moment = moment_

const { TabPane } = Tabs

type ScraperResultDetailsProps = {
  response: ScraperResponse | undefined
  queryKey: ReactQuery.QueryKey
}

export const ScraperResultDetails = ({ response, queryKey }: ScraperResultDetailsProps) => {
  const queryClient = ReactQuery.useQueryClient()

  const buttons = (
    <div>
      <Button onClick={() => queryClient.resetQueries(queryKey)} size="small">Reload</Button>
    </div>
  )

  let initialTime: Moment
  const log = (response?.log ?? []).map((line, i) => {
    const parts = line.match(/^\[(.*, .+ (?:AM|PM)).*?\] (.*)$/)
    if (!parts || parts.length !== 3) return line
    if (i === 0) initialTime = moment(parts[1])

    return (
      <div key={line}>
        <span style={{ color: "red" }}>{moment(parts[1]).diff(initialTime, "seconds")}s </span>
        { parts[2].startsWith("*") ? <span style={{ color: "red" }}>{parts[2]}</span> : parts[2] }
        <br />
      </div>
    )
  })

  return (
    <Tabs tabBarExtraContent={buttons} size="small">
      <TabPane tab="Log" key="log">
        { response ? <pre style={{ fontSize: 10, height: "100%" }}>{log}</pre> : "Loading..." }
      </TabPane>
      <TabPane tab="Results" key="results">
        { response ? (
          <ReactJson
            src={response.flightsWithFares}
            enableClipboard={false}
            displayDataTypes={false}
            indentWidth={2}
            quotesOnKeys={false}
            shouldCollapse={(field) => ["forKey"].some((item) => item === field.name)}
          />
        ) : "Loading..." }
      </TabPane>
    </Tabs>
  )
}
