/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Disables using localStorage to store React Query state if "true" (default: "false") */
  readonly VITE_REACT_QUERY_CACHE_OFF: string

  /** Google client id for oauth (ex. "123123123213-jgjkhewfgj23hgjkhgfk3.apps.googleusercontent.com") */
  readonly VITE_GOOGLE_CLIENT_ID: string

  /** The URL to the Browserless instance that's behind aws api gateway (to run scrapers, ex. "https://xxxxyyyzz.execute-api.us-east-1.amazonaws.com/main/browserless") */
  readonly VITE_BROWSERLESS_AWS_PROXY_URL: string

  /** The x-api-key to pass through to Browserless calls (for aws api gateway) */
  readonly VITE_BROWSERLESS_AWS_PROXY_API_KEY: string

  /** The url to log scraper results to ex: https://123456:apikey@logs-prod3.grafana.net/loki/api/v1/push (optional) */
  readonly VITE_LOKI_LOGGING_URL: string

  /** Customize the loki logging user id when calling logging scraper results */
  readonly VITE_LOKI_LOGGING_UID: string

  /** Used to look up the the timezone of airports by longitude and latitude when marking fares */
  readonly VITE_GEOAPIFY_API_KEY: string

  /** Set this to run scraper tests live against production */
  readonly VITE_LIVE_SCRAPER_TESTS: string

  /** The mailer SMTP connection string (use a free SendGrid account if you need one)
   * ex. smtps://username%40gmail.com:password@smtp.sendgrid.net:465 */
  readonly VITE_SMTP_CONNECTION_STRING: string

  /** Set to true to use the local emulators for Firebase versus production */
  readonly VITE_USE_FIREBASE_EMULATORS: string

  /** Set to the config information (in JSON format with quoted attribute names) from
   * 'Settings > Project settings > General' and scroll to the bottom and select Config for your web app.
   * The format is: {"apiKey": "...", "authDomain": "...", ...} */
  readonly VITE_FIREBASE_CONFIG_JSON: string

  /** Beginning of url where we will hit our functions. Ex: `https://us-central1-ABCD.cloudfunctions.net`.
   * This is overridden when using firebase emulators. */
  readonly VITE_FIREBASE_FUNCTIONS_URL: string

  /** Set to the full service account JSON without line breaks from 'Settings > Project settings > Service accounts'
   * from when you created it. If you create a new one now, note the old one will be immediately disabled.
   * The service account is used by workers.
   * The format is: {"type": "service_account", "project_id": "awardwiz", "private_key_id": "...", ...} */
  readonly VITE_FIREBASE_SERVICE_ACCOUNT_JSON: string
}

// eslint-disable-next-line no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv
}
