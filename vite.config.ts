/// <reference types="vitest" />

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import Icons from "unplugin-icons/vite"
import { visualizer } from "rollup-plugin-visualizer"

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      path: "path-browserify",
    },
  },

  plugins: [
    react(),
    Icons({
      compiler: "jsx",
      jsx: "react",
      defaultStyle: "vertical-align: text-bottom;"
    }),
    visualizer({ open: true })
  ],

  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      reporter: ["lcovonly"],
      enabled: true,
      clean: true,
    }
  },
})
