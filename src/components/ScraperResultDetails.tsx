import * as ReactQuery from "@tanstack/react-query"
import { ScraperResponse } from "../types/scrapers"
import { Alert, Button, Tabs } from "antd"
import { default as dayjs, Dayjs } from "dayjs"

type ScraperResultDetailsProps = {
  response: ScraperResponse | undefined
  queryKey: ReactQuery.QueryKey
}

export const ScraperResultDetails = ({ response, queryKey }: ScraperResultDetailsProps) => {
  const queryClient = ReactQuery.useQueryClient()
  const meta = queryClient.getQueryState<ScraperResponse, { message: string, log: string[]}>(queryKey)
  const rawLog = response?.log ?? meta?.error?.log ?? []

  let initialTime: Dayjs
  const logLines = rawLog.map((line, lineNumber) => {
    // eslint-disable-next-line unicorn/better-regex
    const parts = line.match(/^\[(.*, .+ (?:AM|PM)).*?\] (.*)$/)
    if (!parts || parts.length !== 3) return line
    if (lineNumber === 0) initialTime = dayjs(parts[1])

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

  const buttons = <Button style={{ marginLeft: 100 }} onClick={() => queryClient.resetQueries(queryKey)} size="small">Reload</Button>
  const tabItems = [
    { label: "Log", key: "log", children: log },
  ]
  return (<Tabs tabBarExtraContent={buttons} size="small" items={tabItems} />)
}
