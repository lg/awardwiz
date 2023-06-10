/// <reference types="vitest" />
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    maxConcurrency: 5,
    silent: true,
    testTimeout: 60000
  },
})
