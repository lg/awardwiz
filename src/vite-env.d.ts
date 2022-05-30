/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Disables using localStorage to store React Query state if "true" (default: "false") */
  readonly VITE_REACT_QUERY_CACHE_OFF: string

  /** Shows the React Query dev tools flower in the bottom left if "true" (default: "false") */
  readonly VITE_REACT_QUERY_DEV_TOOLS: string

  /** Supabase url (ex. "https://aaaaaabbbbbbbccccc.supabase.co") */
  readonly VITE_SUPABASE_URL: string

  /** Supabase anon JWT token (its really long, check on jwt.io for role=anon, it may fail signature)  */
  readonly VITE_SUPABASE_ANON_KEY: string

  /** Google client id for oauth (ex. "123123123213-jgjkhewfgj23hgjkhgfk3.apps.googleusercontent.com") */
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
