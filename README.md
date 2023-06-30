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

## Quickstart

1. Load the project into VSCode and launch the Dev Container (make sure to have the Dev Container VSCode extension installed)
2. Start a scraper with, for example: `just run-scraper aa SFO LAX 2023-12-01`
3. If you want to run the front-end, create a `.env` file, start the scraper server `just run-server` and start the web frontend `just run-vite`

## Architecture

There are three parts to Awardwiz: the frontend (in `awardwiz/`), the scrapers that run on the serverside (in `awardwiz-scrapers/`), and Arkalis (in `arkalis/`) which is the detection-sensitive scraping engine written for this project. Firebase is currently also used to store the user database, although this will be replaced soon.

This is a Node.js project with a strict Typescript setup (and enforced by eslint, via git commit hooks, and `just check` runs). `just` is used for common actions and `npm` is assumed for package management for Node. All these tools and other linters are pre-installed as part of the VSCode Dev Container. It's strongly recommended you use the Dev Container since everything's already installed, including XVFB and Chromium so you can visually debug scrapers. See the `.devcontainer/devcontainer.json` file for how the environment is built.

The frontend is a React app that uses [Ant Design](https://github.com/ant-design/ant-design/) for UI components. It's built using [Vite](https://github.com/vitejs/vite).

The backend is a Node.js server that uses [Arkalis](arkalis/README.md) to run scrapers. It has a variety of commands to help write and debug scrapers.

The `just` command is used to access a variety of scripts, including `just test` to run the tests, `just check` to build and lint your code, `just run-scraper <name> <origin> <destination> <yyyy-mm-dd>` to run a scraper, `run-vite`/`run-server` to run the front-end server plus the scrapers backend server. Note that if you're developing in VSCode, you can use the `Run scraper` Launch item and you'll have the full VSCode debugger available to you for debugging scrapers.

## `.env`

A few environment variables are used to start the server and frontend. These are in a `.env` file in the root of the workspace. These are only necessary if you are running the front-end server. If you're using `just run-scraper` for example, none are needed.

**Required Variables**
- `VITE_GOOGLE_CLIENT_ID`: A Google client ID with OAuth capabilities (used for identity of users). You can get this from your Firebase Auth instance (Authentication > Sign-in method > Google > Web SDK confirmation > Web client ID)
- `VITE_FIREBASE_CONFIG_JSON`: Set to the config information (in JSON format with quoted attribute names) from 'Settings > Project settings > General' and scroll to the bottom and select Config for your web app. The format is: `{"apiKey": "...", "authDomain": "...", ...}`
- `VITE_SCRAPERS_URL`: The web browser-accessible url for `awardwiz-scrapers` , example: `http://127.0.0.1:2222`

**Optional Variables**
- `VITE_USE_FIREBASE_EMULATORS`: When running locally, setting this to `true` will use the default Firebase emulators. Don't forget to start them using `firebase emulators:start`.
- `VITE_LOKI_LOGGING_URL`: The url to log scraper results to ex: `https://123456:apikey@logs-prod3.grafana.net/loki/api/v1/push`
- `VITE_LOKI_LOGGING_UID`: Customize the loki logging user id when calling logging scraper results (defaults to `unknown`)
- `VITE_SMTP_CONNECTION_STRING` required for sending email notifications (still in progress). This is used when using `pnpm run marked-fares-worker`. **This is a secret and should not be public**
- `VITE_FIREBASE_SERVICE_ACCOUNT_JSON`: Set to the full service account JSON without line breaks from 'Settings > Project settings > Service accounts' from when you created it. If you create a new one now, note the old one will be immediately disabled. The service account is used by workers. The format is: `{"type": "service_account", "project_id": "awardwiz", "private_key_id": "...", ...}`. **This is a secret and should not be public**
- `SERVICE_WORKER_JWT_SECRET`: A string of whatever you want that is used to identify your service account backend that won't be rate-limited on the scrapers server
