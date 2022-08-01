import React, { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { FlightSearch } from "../components/FlightSearch"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// @ts-expect-error required to render things
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeAll(() => {
  // Needed for antd to render
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {}
    })
  })
})

// TODO: unskip
describe.skip("basic operations", () => {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  it.only("completes an initial render", () => {
    const node = wrapper({ children: <FlightSearch /> })
    const rendered = render(node).container
    expect(rendered.querySelectorAll(".ant-tree-title").length).toBeGreaterThanOrEqual(3)
    expect(rendered.querySelectorAll(".ant-tree-title")[0].textContent).toMatch(/Search for .*? → .*? on .*?-.*?-.*/)
  })
})
