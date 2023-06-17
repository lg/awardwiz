<div align="center">
  <div><img src="wizard.png" style="width:200px" /></div>
  <div><h1>AwardWiz</h1></div>
  <div><img src="screenshot.png" style="max-width:600px" /></div>
</div>
<br/>

AwardWiz searches airlines for award tickets so you can fly like a king, remorse-free. http://awardwiz.com

- Searches all permutations of origins and destinations (direct flights only for now)
- See when low-fares are available (`X`, `I`, `O`, etc) vs cash-based fares (for [Chase Ultimate Rewards](https://thepointsguy.com/guide/redeeming-chase-ultimate-rewards-maximum-value/))
- Searches: `aa`, `aeroplan`, `alaska`, `delta` (temp broken), `jetblue`, `southwest` and `united` (temp broken), along with `skiplagged` for points-to-cash estimates
- Diligently tried to avoid the various commercial anti-botting mitigations used by airlines
- Tries getting reliable WiFi and/or lie-flat pod availability
- *Coming soon* Get emailed when award space opens up
- *Coming soonish* Automatically calculate region-based miles based on published award charts

# Architecture

There are three parts to Awardwiz: the frontend (in `awardwiz/`), the scrapers that run on the serverside (in `awardwiz-scrapers/`), and Arkalis (in `arkalis/`) which is the detection-sensitive scraping engine written for this project. Firebase is currently also used to store the user database, although this will be replaces soon.

This is a Node.js project with a strict Typescript setup (and enforced by eslint, via git commit hooks, and `just check` runs). `just` is used for common actions and `npm` is assumed for package management for Node.

The frontend is a React app that uses [Ant Design](https://github.com/ant-design/ant-design/) for UI components. It's built using [Vite](https://github.com/vitejs/vite).

The backend is a Node.js server that uses [Arkalis](arkalis/README.md) to run scrapers. It has a variety of commands to help write and debug scrapers.

## Running locally (NEEDS UPDATING)

A few environment variables are used to start the server and frontend. These can be listed in a `.env.local` file:

**Required Variables**
- `VITE_GOOGLE_CLIENT_ID`: A Google client ID with OAuth capabilities (used for identity of users). You can get this from your Firebase Auth instance (Authentication > Sign-in method > Google > Web SDK confirmation > Web client ID)
- `VITE_FIREBASE_CONFIG_JSON`: Set to the config information (in JSON format with quoted attribute names) from 'Settings > Project settings > General' and scroll to the bottom and select Config for your web app. The format is: `{"apiKey": "...", "authDomain": "...", ...}`
- `VITE_SCRAPERS_URL`: The URL for `awardwiz-scrapers`, example: `http://127.0.0.1:2222`

**Optional Variables**
- `VITE_USE_FIREBASE_EMULATORS`: When running locally, setting this to `true` will use the default Firebase emulators. Don't forget to start them using `firebase emulators:start`.
- `VITE_LOKI_LOGGING_URL`: The url to log scraper results to ex: `https://123456:apikey@logs-prod3.grafana.net/loki/api/v1/push`
- `VITE_LOKI_LOGGING_UID`: Customize the loki logging user id when calling logging scraper results (defaults to `unknown`)
- `VITE_SMTP_CONNECTION_STRING` required for sending email notifications (still in progress). This is used when using `pnpm run marked-fares-worker`. **This is a secret and should not be public**
- `VITE_FIREBASE_SERVICE_ACCOUNT_JSON`: Set to the full service account JSON without line breaks from 'Settings > Project settings > Service accounts' from when you created it. If you create a new one now, note the old one will be immediately disabled. The service account is used by workers. The format is: `{"type": "service_account", "project_id": "awardwiz", "private_key_id": "...", ...}`. **This is a secret and should not be public**

You can start a local instance of Browserless using `docker-compose up`.

### Helpful best practices when writing scrapers (NEEDS UPDATING)

1. Most important rule: Try your best to not need to keep changing proxies because you get detected by anti-botting. Proxies are slow, unreliable and can get expensive. It's cheaper and easier to scale things by writing scrapers that don't get detected easily.
2. See the Javadoc comments in `scraper.ts`.
3. When running locally, a vnc server is started that can be controlled by visiting: http://127.0.0.1:8282/vnc.html
4. Use `pauseAfterError` and `pauseAfterRun` when writing the initial scraper code such that you can debug unexpected errors. This uses Playwright's `page.pause()` which shows the `codegen` tool that can help pick good selectors for the scraper rules. `sc.page.setDefaultTimeout(5000)` might be helpful at the beginning of your scraper too to fail quicker when things are missing.
5. Getting a scraper to be complete end-to-end in **5 seconds** is amazing, **5-10 seconds** is good, **10-15 seconds** is ok, **15+ seconds** isn't great. Cache everything that you can, block unnecessary outside vendors they're using, try to directly do xhr requests instead of filling out forms (when possible). It's all a balance of the amount of anti-botting they're using vs scraping speed. The more clever and thoughtful you are, the faster and more resilient the scraper will be.
6. If the xhr for the actual flight results takes a while to get requested, use `showFullRequest` to see when the request actually starts, maybe there's a dependent request that can be cached.
7. If stuck behind anti-botting, try: `useIpTimezone`, `useRandomUserAgent`, `useBrowsers`, etc

### Getting started (NEEDS UPDATING, SORRY)

1. `npm i`
2. install `just`
3. configure your `.env` file
5. `just run-server`
6. `just start-vite`
7. run github actions locally with `act --list` and `act -j <job-id>`

