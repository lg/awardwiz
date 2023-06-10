import { Tooltip } from "antd"
import * as React from "react"

export const FastTooltip = ({ title, children }: { title: React.ReactNode, children?: React.ReactNode }) => {
  return (
    <Tooltip title={title} mouseEnterDelay={0} mouseLeaveDelay={0} destroyTooltipOnHide={{ keepParent: false }}>
      {children}
    </Tooltip>
  )
}
