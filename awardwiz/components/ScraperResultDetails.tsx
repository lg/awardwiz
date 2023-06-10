import * as ReactQuery from "@tanstack/react-query"
import { ScraperResponse } from "../types/scrapers.js"
import { Alert, Button, Tabs } from "antd"

type ScraperResultDetailsProps = {
  response: ScraperResponse | undefined
  queryKey: ReactQuery.QueryKey
}

export const ScraperResultDetails = ({ response, queryKey }: ScraperResultDetailsProps) => {
  const queryClient = ReactQuery.useQueryClient()
  const meta = queryClient.getQueryState<ScraperResponse, { message: string, logLines: string[]}>(queryKey)
  const logLines = meta?.error?.logLines ?? response?.logLines ?? []

  let log = <Alert showIcon message="Loading..." type="info" />
  if (logLines.length > 0)
    log = <pre style={{ fontSize: 10, height: "100%" }}>{logLines.join("\n")}</pre>

  const buttons = <Button style={{ marginLeft: 100 }} onClick={() => void queryClient.resetQueries(queryKey) } size="small">Reload</Button>
  const tabItems = [
    { label: "Log", key: "log", children: log },
  ]
  return (<Tabs tabBarExtraContent={buttons} size="small" items={tabItems} />)
}
