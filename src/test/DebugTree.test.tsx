import { describe, expect, it } from "vitest"
import { act, render, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { DebugTree, DebugTreeNode } from "../components/DebugTree"

beforeAll(() => { vi.useFakeTimers() })
afterAll(() => { vi.runOnlyPendingTimers(); vi.useRealTimers() })

// screen.logTestingPlaygroundURL()
// import { logRoles } from "@testing-library/dom"

describe("DebugTree", () => {
  const defaultItem: DebugTreeNode = { key: "root", parentKey: "", text: "abc", stableIcon: <></>, isLoading: false }

  it("should support a basic item", async () => {
    // make sure an empty tree works
    render(<DebugTree debugTree={[]} rootKey="root" />)

    // simple item
    const out = render(<DebugTree debugTree={[{ ...defaultItem }]} rootKey="root" />)
    expect(out.queryByText("abc")).toBeInTheDocument()
  })

  it("should support items with errors", () => {
    const out = render(<DebugTree debugTree={[{ ...defaultItem, error: true }]} rootKey="root" />)
    expect(out.getByText(/abc/i)).toHaveStyle("color: red")
  })

  it("should support items that are loading", () => {
    // loading should show a spinner
    const items = [{ ...defaultItem, isLoading: true }]
    const out = render(<DebugTree debugTree={items} rootKey="root" />)
    expect(out.queryByRole("img", { name: "loading" })).toBeInTheDocument()

    // removing the loading flag and waiting should show the total time in the text and stop the spinner
    act(() => {
      items[0].isLoading = false
      vi.advanceTimersByTime(1500)
    })
    out.rerender(<DebugTree debugTree={items} rootKey="root" />)
    expect(out.queryByText("(1.5s)")).toBeInTheDocument()
    expect(out.queryByRole("img", { name: "loading" })).not.toBeInTheDocument()

    // resetting loading flag should show spinner and remove the total-time from before
    act(() => { items[0].isLoading = true })
    out.rerender(<DebugTree debugTree={items} rootKey="root" />)
    expect(out.queryByRole("img", { name: "loading" })).toBeInTheDocument()
    expect(out.queryByText(/\(.*?s\)/)).not.toBeInTheDocument()
  })

  it("should support popover when clicking on the item", async () => {
    const out = render(<DebugTree debugTree={[{ ...defaultItem, details: "hello" }]} rootKey="root" />)
    expect(out.queryByText("hello")).not.toBeInTheDocument()

    // clicking the item should show the popup
    fireEvent(out.getByText("abc"), new MouseEvent("click", { bubbles: true, cancelable: true }))
    expect(out.queryByText("hello")).toBeInTheDocument()
  })
})
