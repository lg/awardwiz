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

<br/>

# Scraper Status

![aa](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=aa) ![aeroplan](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=aeroplan) ![alaska](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=alaska) ![delta](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=delta) ![jetblue](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=jetblue) ![skiplagged](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=skiplagged) ![skyscanner](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=skyscanner) ![southwest](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=southwest) ![united](https://untitled-n0tvu4usv9sd.runkit.sh/badge?scraper=united)

(Badges auto-updated twice-daily based on latest [Github Actions test run](https://github.com/lg/awardwiz/actions/workflows/scraper-tests.yaml) and [generator script](https://runkit.com/lg-/637ac74ba242730009cda1f8))

<br/>

# Architecture

The Typescript React-based frontend calls a [Browserless](https://github.com/browserless/chrome) backend to scrape airlines' award search pages with [Puppeteer](https://github.com/puppeteer/puppeteer). Backend database for user prefs is [Supabase](https://supabase.com). [Vite](https://github.com/vitejs/vite) is used as the dev server (`pnpm start`), [Vitest](https://github.com/vitest-dev/vitest) is used for tests (`pnpm test` and `pnpm test-scrapers`). UI framework is [Ant Design](https://github.com/ant-design/ant-design/). The package manager recommended is [pnpm](https://github.com/pnpm/pnpm).

Source code formatting and acceptable patterns are highly opinionated and enforced via eslint. This is checked as a git commit hook but can also be run with `pnpm run check` (also checks dependencies, and builds the page).

Several environment variables are *required* to start the server and frontend. It's not ideal right now, and I hope to remove these as requirements for hosting at least locally soon. These can be listed in a `.env.local` file:

- `VITE_GOOGLE_CLIENT_ID`: A Google client ID with OAuth capabilities (used for identity of users).
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_KEY`: Supabase credentials for storing user settings and scraper logs. Dont forget to edit `src/scrapers/common.ts` with these values too. Be careful not to expose your service key in public.
- `VITE_BROWSERLESS_AWS_PROXY_URL` and `VITE_BROWSERLESS_AWS_PROXY_API_KEY`: AWS API Gateway credentials for fronting browserless
- `VITE_SMTP_CONNECTION_STRING` required for sending email notifications (still in progress). This is used when using `pnpm run marked-fares-worker`. Be careful not to expose in public.

You can start a local instance of Browserless using `docker-compose up`.