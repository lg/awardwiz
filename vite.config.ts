/// <reference types="vitest" />

/* eslint-disable import/no-extraneous-dependencies */

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import Icons from "unplugin-icons/vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    Icons({
      compiler: "jsx",
      jsx: "react",
      defaultStyle: "vertical-align: text-bottom;"
    }),
  ],

  test: {
    includeSource: ["src/**/*.{js,tsx}"],
    coverage: {
      reporter: ["lcovonly"],
      enabled: true,
      clean: true,
    }
  },
})
