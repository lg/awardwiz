import { LoadingOutlined } from "@ant-design/icons"
import { Tree } from "antd"
import React, { ReactNode } from "react"

type DebugTreeNodeNoComputed = { key: string, children: DebugTreeNode[], textA: ReactNode, textB: ReactNode, origIcon: ReactNode, isLoading: boolean }
export type DebugTreeNode = DebugTreeNodeNoComputed & { title: string, icon: ReactNode }
type DebugTreeNodeUpdate = Partial<Omit<DebugTreeNodeNoComputed, "key">>

type DebugTreeAction = { type: "update", payload: { key: string, updateData: DebugTreeNodeUpdate } }
type Dispatch = (action: DebugTreeAction) => void
export const DebugTreeContext = React.createContext<Dispatch | undefined>(undefined)

const allKeys = (item: {key: string, children: unknown[]}, collectedKeys: string[]): string[] => {
  if (item.children)
    collectedKeys.push(item.key)
  item.children.forEach((child) => allKeys(child as {key: string, children: unknown[]}, collectedKeys))
  return collectedKeys
}

const findInTree = (node: DebugTreeNode, findKey: string): DebugTreeNode | undefined => {
  if (node.key === findKey)
    return node
  if (node.children.length === 0)
    return undefined
  return node.children.reduce((acc: DebugTreeNode | undefined, child) => (acc || findInTree(child, findKey)), undefined)
}

export const genNewDebugTreeNode = (newNode: Partial<Omit<DebugTreeNodeNoComputed, "key">> & { key: string }): DebugTreeNode => {
  const node: DebugTreeNode = { textA: "", textB: "", icon: "", title: "", children: [], key: newNode.key, origIcon: "", isLoading: false }
  return updateDebugTree(node, node.key, newNode)   // to run computed properties
}

const updateDebugTree = (tree: DebugTreeNode, key: string, updateData: DebugTreeNodeUpdate) => {
  const newTree = { ...tree }
  const node = newTree.key === key ? newTree : findInTree(newTree, key)
  if (!node) {
    debugger
    throw new Error(`Could not find node with key ${key}`)
  }

  // When we have children by the same keys coming in, we don't want to overwrite them
  const { children: updateChildren, ...updateDataNoChildren } = updateData
  Object.assign(node, updateDataNoChildren)
  updateChildren?.forEach((child) => {
    if (!node.children.find((checkElement) => child.key === checkElement.key))
      node.children.push(child)
  })

  // Remove nodes that are missing
  node.children.forEach((child) => {
    if (!updateData.children?.find((checkElement) => child.key === checkElement.key))
      node.children.splice(node.children.indexOf(child), 1)
  })

  node.title = `${node.textA}${node.textB!.toString().length > 0 ? ` (${node.textB})` : ""}`
  node.icon = node.isLoading ? <LoadingOutlined /> : node.origIcon

  return newTree
}

export const useDebugTree = () => {
  const context = React.useContext(DebugTreeContext)
  if (context === undefined)
    throw new Error("useDebugTree must be used within a DebugTreeProvider")
  return context
}

const reducer = (state: DebugTreeNode, action: DebugTreeAction) => {
  if (action.type === "update")
    return updateDebugTree(state, action.payload.key, action.payload.updateData)
  throw new Error(`Unknown action type: ${action.type}`)
}

export const DebugTreeProvider = (props: React.PropsWithChildren<{ rootNode: DebugTreeNode }>) => {
  const [state, dispatch] = React.useReducer(reducer, props.rootNode)

  return (
    <DebugTreeContext.Provider value={dispatch}>
      {props.children}
      <Tree style={{ marginTop: 10 }} showIcon showLine={{ showLeafIcon: false }} expandedKeys={allKeys(state, [])} treeData={[state]} />
    </DebugTreeContext.Provider>
  )
}
