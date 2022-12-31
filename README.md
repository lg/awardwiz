<div align="center">
  <div><img src="src/wizard.png" style="width:200px" /></div>
  <div><h1>AwardWiz</h1></div>
  <div><img src="src/screenshot.png" style="max-width:600px" /></div>
</div>
<br/>

AwardWiz searches airlines for award tickets so you can fly like a king, remorse-free. http://awardwiz.com

- Searches all permutations of origins and destinations (direct flights only for now)
- See when low-fares are available (`X`, `I`, `O`, etc) vs cash-based fares (for [Chase Ultimate Rewards](https://thepointsguy.com/guide/redeeming-chase-ultimate-rewards-maximum-value/))
- Searches: `aa`, `aeroplan`, `alaska`, `delta`, `jetblue`, `southwest` and `united`, along with `skiplagged` and `skyscanner` (currently disabled) for points-to-cash estimates
- Scrapers used to obtain data usually avoid various anti-botting mitigations used by airlines and live tests are run [twice-daily](https://github.com/lg/awardwiz/actions/workflows/scraper-tests.yaml) to make sure scrapers usually work
- Know when WiFi and/or lie-flat pods will be available
- *Coming soon* Get emailed when award space opens up
- *Coming soon* Automatically calculate region-based miles based on published award charts

# Architecture

The Typescript React-based frontend calls a [Browserless](https://github.com/browserless/chrome) backend to scrape airlines' award search pages with [Puppeteer](https://github.com/puppeteer/puppeteer). Backend database for user prefs is [Firebase](http://firebase.google.com). [Vite](https://github.com/vitejs/vite) is used as the dev server (`pnpm start`), [Vitest](https://github.com/vitest-dev/vitest) is used for tests (`pnpm test` and `pnpm test-scrapers`). UI framework is [Ant Design](https://github.com/ant-design/ant-design/). The recommended package manager is [pnpm](https://github.com/pnpm/pnpm).

Source code formatting and acceptable patterns are highly opinionated and enforced via eslint. This is checked as a git commit hook but can also be run with `pnpm run check` (also checks dependencies, and builds the page).

## Running locally

A few environment variables are used to start the server and frontend. These can be listed in a `.env.local` file:

**Required Variables**
- `VITE_GOOGLE_CLIENT_ID`: A Google client ID with OAuth capabilities (used for identity of users). You can get this from your Firebase Auth instance (Authentication > Sign-in method > Google > Web SDK confirmation > Web client ID)
- `VITE_FIREBASE_CONFIG_JSON`: Set to the config information (in JSON format with quoted attribute names) from 'Settings > Project settings > General' and scroll to the bottom and select Config for your web app. The format is: `{"apiKey": "...", "authDomain": "...", ...}`
- `VITE_SCRAPERS_URL`: The URL on Google Functions where the scrapers are deployed. ex: `https://awardwiz-abcdefgh-uc.a.run.app`

**Optional Variables**
- `VITE_USE_FIREBASE_EMULATORS`: When running locally, setting this to `true` will use the default Firebase emulators. Don't forget to start them using `firebase emulators:start`.
- `VITE_FIREBASE_FUNCTIONS_URL`: The Firebase Functions URL used as the beginning of function requests. Required only for production. Ex: `https://us-central1-ABCD.cloudfunctions.net`.
- `VITE_LOKI_LOGGING_URL`: The url to log scraper results to ex: `https://123456:apikey@logs-prod3.grafana.net/loki/api/v1/push`
- `VITE_LOKI_LOGGING_UID`: Customize the loki logging user id when calling logging scraper results (defaults to `unknown`)
- `VITE_SMTP_CONNECTION_STRING` required for sending email notifications (still in progress). This is used when using `pnpm run marked-fares-worker`. **This is a secret and should not be public**
- `VITE_FIREBASE_SERVICE_ACCOUNT_JSON`: Set to the full service account JSON without line breaks from 'Settings > Project settings > Service accounts' from when you created it. If you create a new one now, note the old one will be immediately disabled. The service account is used by workers. The format is: `{"type": "service_account", "project_id": "awardwiz", "private_key_id": "...", ...}`. This is also used for deploying to Firebase Functions. **This is a secret and should not be public**

You can start a local instance of Browserless using `docker-compose up`.

To deploy the Firebase Functions to production, first add `Artifact Registry Administrator` and `Cloud Functions Developer` on `https://console.cloud.google.com/iam-admin/iam` for the project, and then either:
  - Locally: Put the contents of `VITE_FIREBASE_SERVICE_ACCOUNT_JSON` into a new file, `serviceaccount.json`, and run `GOOGLE_APPLICATION_CREDENTIALS=serviceaccount.json pnpm deploy-functions`
  - Using `act` (also useful to test the Github Action): `act -W .github/workflows/upload-functions.yaml --secret-file .env.local`
