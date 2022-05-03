/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable object-property-newline */
/* eslint-disable operator-linebreak */

import React from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { allKeys, DebugTreeNode, findInTree, genNewDebugTreeNode, updateDebugTree } from "../components/DebugTree"
import MdiEarth from "~icons/mdi/earth"

describe.concurrent("the tree modification functions", () => {
  let root: DebugTreeNode
  beforeEach(() => {
    root = genNewDebugTreeNode({ key: "root", children: [
      genNewDebugTreeNode({ key: "child1", children: [] }),
      genNewDebugTreeNode({ key: "child2", children: [
        genNewDebugTreeNode({ key: "child2-1", children: [] })
      ] })
    ] })
  })

  it("finds the expected nodes", () => {
    const child2 = findInTree(root, "child2")!
    expect(child2.key).toEqual("child2")
    expect(child2.children[0].key).toEqual("child2-1")
  })

  it("removes nodes and adds new ones", () => {
    const child2 = findInTree(root, "child2")!
    expect(child2.children.length).toEqual(1)
    expect(child2.children[0].key).toEqual("child2-1")

    const child22 = genNewDebugTreeNode({ key: "child2-2", children: [], textA: "hello" })
    updateDebugTree(child2, "child2", { children: [child22] })

    // if children are missing from the list, they should be deleted
    expect(findInTree(root, "child2-1")).toBeUndefined()
    expect(() => { updateDebugTree(child2, "child2-1", { children: [] }) }).toThrowError()

    // check that the new node was added
    expect(child2.children.length).toEqual(1)
    expect(findInTree(root, "child2-2")).toEqual(child22)

    // adding a new node should not overwrite the old one if the key is the same
    const child22other = genNewDebugTreeNode({ key: "child2-2", children: [], textA: "goodbye" })
    updateDebugTree(child2, "child2", { children: [child22other] })
    expect(findInTree(root, "child2-2")?.textA).toEqual("hello")

    // but adding a new node with a different key should remove anything else not in the children array
    const child23 = genNewDebugTreeNode({ key: "child2-3", children: [], textA: "hi" })
    updateDebugTree(child2, "child2", { children: [child23] })
    expect(findInTree(root, "child2-2")).toBeUndefined()
    expect(child2.children.length).toEqual(1)
    expect(child2.children[0]).toEqual(child23)
  })

  it("properly lists all keys", () => {
    const keys = allKeys(root, [])
    expect(keys.length).toEqual(4)
    expect(keys).toEqual(["root", "child1", "child2", "child2-1"])
  })

  it("properly generates computed values", () => {
    const node = genNewDebugTreeNode({ key: "node", textA: "hello", textB: "world", isLoading: true, origIcon: <MdiEarth /> })
    expect(node.title).toEqual("hello (world)")

    // should be a loading icon
    expect(node.icon).not.toEqual(<MdiEarth />)

    // should be the real icon and no bracketed text
    const x = updateDebugTree(node, "node", { isLoading: false, textB: "" })
    expect(x.title).toEqual("hello")
    expect(x.icon).toEqual(<MdiEarth />)
  })
})
