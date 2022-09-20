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

  /** Supabase service JWT token (keep this secret and do not publish in clientside)  */
  readonly VITE_SUPABASE_SERVICE_KEY: string

  /** Google client id for oauth (ex. "123123123213-jgjkhewfgj23hgjkhgfk3.apps.googleusercontent.com") */
  readonly VITE_GOOGLE_CLIENT_ID: string

  /** The URL to the Browserless instance that's behind aws api gateway (to run scrapers, ex. "https://xxxxyyyzz.execute-api.us-east-1.amazonaws.com/main/browserless") */
  readonly VITE_BROWSERLESS_AWS_PROXY_URL: string

  /** The x-api-key to pass through to Browserless calls (for aws api gateway) */
  readonly VITE_BROWSERLESS_AWS_PROXY_API_KEY: string

  /** Set this to run scraper tests live against production */
  readonly VITE_LIVE_SCRAPER_TESTS: string
}

// eslint-disable-next-line no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv
}
