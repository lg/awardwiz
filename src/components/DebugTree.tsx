import { Alert, Popover, Tree } from "antd"
import React, { ReactNode, useEffect } from "react"
import Text from "antd/lib/typography/Text"
import { LoadingOutlined, StopOutlined } from "@ant-design/icons"

export type DebugTreeNode = { key: string, parentKey: string, stableIcon: ReactNode, isLoading: boolean, text: ReactNode, error: Error | undefined, details?: ReactNode, detailsTitle?: ReactNode }
export type DebugTreeNodeComputed = { key: string, title: ReactNode, icon: ReactNode, children: DebugTreeNodeComputed[] }

const allKeys = (item: {key: string, children: unknown[]}, collectedKeys: string[]): string[] => {
  if (item.children.length > 0)
    collectedKeys.push(item.key)
  item.children.forEach((child) => allKeys(child as {key: string, children: unknown[]}, collectedKeys))
  return collectedKeys
}

export const DebugTree = ({ debugTree, rootKey }: { debugTree: DebugTreeNode[], rootKey: string }) => {
  const [nodeMeta, setNodeMeta] = React.useState<Record<string, { startTime: number, endTime: number } | undefined>>({})
  useEffect(() => setNodeMeta({}), [rootKey])   // reset metadata of keys when root key changes to avoid showing stale data

  const defaultNodeMeta = { startTime: 0, endTime: 0 }
  const computeNode = (node: DebugTreeNode): DebugTreeNodeComputed => {
    const meta = nodeMeta[node.key]
    if (!meta)
      setNodeMeta((prev) => ({ ...prev, [node.key]: defaultNodeMeta }))
    if (node.isLoading && !meta?.startTime)
      setNodeMeta((prev) => ({ ...prev, [node.key]: { startTime: Date.now(), endTime: 0 } }))
    if (!node.isLoading && meta?.startTime && !meta.endTime)
      setNodeMeta((prev) => ({ ...prev, [node.key]: { ...meta, endTime: Date.now() } }))
    if (node.isLoading && meta?.endTime)
      setNodeMeta((prev) => ({ ...prev, [node.key]: { ...meta, startTime: Date.now(), endTime: 0 } }))

    let title = <span style={{ color: node.error ? "red" : undefined }}>{node.text}</span>
    if (node.error && node.error.message !== "stopped") {
      title = <span>{title} <Alert showIcon message={node.error.message} type="error" /></span>
    } else if (meta?.startTime && meta.endTime && !node.error) {
      title = <span>{title} <Text style={{ fontSize: "0.75em" }}>({((meta.endTime! - meta.startTime) / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s)</Text></span>
    }

    const popover = (node.details && node.detailsTitle)
      ? <Popover title={node.detailsTitle} content={node.details} trigger="click" placement="right" destroyTooltipOnHide autoAdjustOverflow overlayInnerStyle={{ maxHeight: 500, overflow: "scroll" }}>{title}</Popover>
      : title

    let icon = node.stableIcon
    if (node.isLoading) icon = <LoadingOutlined />
    else if (node.error) icon = <StopOutlined style={{ color: "red" }} />

    const children = debugTree.filter((checkNode) => checkNode.parentKey === node.key).map((childNode) => computeNode(childNode))
    return { key: node.key, title: popover, icon, children }
  }

  const rootNode = debugTree.find((node) => node.key === rootKey)
  const rootNodeComputed = rootNode && computeNode(rootNode)

  return (
    <Tree style={{ marginTop: 10 }} showIcon showLine={{ showLeafIcon: false }} expandedKeys={rootNodeComputed ? allKeys(rootNodeComputed, []) : []} treeData={rootNodeComputed ? [rootNodeComputed] : []} />
  )
}
