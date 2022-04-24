/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Disables using localStorage to store React Query state if "true" (default: "false") */
  readonly VITE_REACT_QUERY_CACHE_OFF: string

  /** Shows the React Query dev tools flower in the bottom left if "true" (default: "false") */
  readonly VITE_REACT_QUERY_DEV_TOOLS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}