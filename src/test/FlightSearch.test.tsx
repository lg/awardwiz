import React, { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { render, cleanup } from "@testing-library/react"
import "@testing-library/jest-dom"

import { FlightSearch } from "../components/FlightSearch"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

beforeAll(() => {
  // Needed for antd to render
  Object.defineProperty(window, "matchMedia", { value: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) })
})

afterEach(() => { cleanup() })

beforeAll(() => {
  vi.mock("@supabase/supabase-js", () => ({
    createClient: () => ({
      auth: { getUser: () => Promise.resolve({ data: { user: { email: "abc@def.com" } } }) },
      from: () => ({ select: vi.fn(), insert: vi.fn() }),
    }),
  }))
})

describe("FlightSearch", () => {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  it("completes an initial render", () => {
    const node = wrapper({ children: <FlightSearch /> })
    const rendered = render(node).container
    expect(rendered.querySelectorAll(".ant-tree-title").length).toBeGreaterThanOrEqual(3)
    expect(rendered.querySelectorAll(".ant-tree-title")[0].textContent).toMatch(/Search for .*? → .*? on .*?-.*?-.*/)
  })
})
