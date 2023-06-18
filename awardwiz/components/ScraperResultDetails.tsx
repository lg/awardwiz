import * as ReactQuery from "@tanstack/react-query"
import { ScraperResponse } from "../types/scrapers"
import { Alert, Button, Tabs } from "antd"
import Ansi from "ansi-to-react"

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
    log = <pre style={{ fontSize: 10, height: "100%" }}><Ansi>{logLines.join("\n")}</Ansi></pre>

  const buttons = <Button style={{ marginLeft: 100 }} onClick={() => queryClient.resetQueries(queryKey)} size="small">Reload</Button>
  const tabItems = [
    { label: "Log", key: "log", children: log },
  ]
  return (<Tabs tabBarExtraContent={buttons} size="small" items={tabItems} />)
}
