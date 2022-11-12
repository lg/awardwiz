/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Disables using localStorage to store React Query state if "true" (default: "false") */
  readonly VITE_REACT_QUERY_CACHE_OFF: string

  /** Shows the React Query dev tools flower in the bottom left if "true" (default: "false") */
  readonly VITE_REACT_QUERY_DEV_TOOLS: string

  /** Google client id for oauth (ex. "123123123213-jgjkhewfgj23hgjkhgfk3.apps.googleusercontent.com") */
  readonly VITE_GOOGLE_CLIENT_ID: string

  /** The URL to the Browserless instance that's behind aws api gateway (to run scrapers, ex. "https://xxxxyyyzz.execute-api.us-east-1.amazonaws.com/main/browserless") */
  readonly VITE_BROWSERLESS_AWS_PROXY_URL: string

  /** The x-api-key to pass through to Browserless calls (for aws api gateway) */
  readonly VITE_BROWSERLESS_AWS_PROXY_API_KEY: string

  /** Set this to run scraper tests live against production */
  readonly VITE_LIVE_SCRAPER_TESTS: string

  /** The mailer SMTP connection string (use a free SendGrid account if you need one)
   * ex. smtps://username%40gmail.com:password@smtp.sendgrid.net:465 */
  readonly VITE_SMTP_CONNECTION_STRING: string
}

// eslint-disable-next-line no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv
}
