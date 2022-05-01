/* eslint-disable import/no-extraneous-dependencies */

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // needed because of react-moment bug: https://github.com/vitejs/vite/issues/7376
  resolve: {
    mainFields: [],
  },
})
