import { Alert, Tree } from "antd"
import React, { ReactNode, useEffect } from "react"
import Text from "antd/lib/typography/Text"
import { LoadingOutlined } from "@ant-design/icons"

export type DebugTreeNode = { key: string, parentKey: string, stableIcon: ReactNode, isLoading: boolean, text: ReactNode, error: Error | undefined }
export type DebugTreeNodeComputed = { key: string, title: ReactNode, icon: ReactNode, children: DebugTreeNodeComputed[] }

const allKeys = (item: {key: string, children: unknown[]}, collectedKeys: string[]): string[] => {
  if (item.children)
    collectedKeys.push(item.key)
  item.children.forEach((child) => allKeys(child as {key: string, children: unknown[]}, collectedKeys))
  return collectedKeys
}

export const DebugTree = ({ debugTree, rootKey }: { debugTree: DebugTreeNode[], rootKey: string }) => {
  const [nodeMeta, setNodeMeta] = React.useState<{[ key: string ]: { startTime: number, endTime: number } | undefined}>({})
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

    let title = <>{node.text}</>
    if (node.error) {
      title = <>{title} <Alert showIcon message={node.error.message} type="error" /></>
    } else if (meta?.startTime && meta.endTime) {
      title = <>{title} <Text style={{ fontSize: "0.75em" }}>({((meta.endTime! - meta.startTime) / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s)</Text></>
    }

    return {
      key: node.key,
      title,
      icon: node.isLoading ? <LoadingOutlined /> : node.stableIcon,
      children: debugTree.filter((checkNode) => checkNode.parentKey === node.key).map((childNode) => computeNode(childNode))
    }
  }

  const rootNode = debugTree.find((node) => node.key === rootKey)
  const rootNodeComputed = rootNode && computeNode(rootNode)

  return (
    <Tree style={{ marginTop: 10 }} showIcon showLine={{ showLeafIcon: false }} expandedKeys={rootNodeComputed ? allKeys(rootNodeComputed, []) : []} treeData={rootNodeComputed ? [rootNodeComputed] : []} />
  )
}
