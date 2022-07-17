/// <reference types="vitest" />

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import Icons from "unplugin-icons/vite"
import { visualizer } from "rollup-plugin-visualizer"

import watchAndRun from "@kitql/vite-plugin-watch-and-run"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    Icons({
      compiler: "jsx",
      jsx: "react",
      defaultStyle: "vertical-align: text-bottom;"
    }),
    visualizer({ open: true }),
    watchAndRun([{
      name: "generate-ts-schemas",
      watch: path.resolve("src/**/*.schema.json"),
      run: "npm run schemas"
    }])
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
