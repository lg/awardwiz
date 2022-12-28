# Creating new scrapers

### Example template

```typescript
import { gotoPage, log } from "../common.js"
import { ScraperMetadata } from "../scraper.js"
import { AwardWizScraper, FlightWithFares } from "../types.js"

export const meta: ScraperMetadata = {
  name: "your-scraper-name",
  unsafeHttpsOk: true,
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  await gotoPage(sc, "https://www.google.com", "networkidle")

  log(sc, "hello!")

  const flightsWithFares: FlightWithFares[] = []
  return flightsWithFares
}
```

### ScraperMetadata

- `name`: the scraper name. (required)
- `unsafeHttpsOk`: when using proxies, some slyly try to mitm to see what you're doing. do not turn this on unless you're only scraping publicly info. (required)
- `noBlocking`: by default will auto-block easylist and other similar lists (see blocking.ts), this disables that.
- `blockUrls`: blocks urls (as per Adblock format). use `showBlocked` debug option to iterate.
- `forceCache`: some websites don't return proper cache headers, this forces matching globs to get cached. use `showUncached` debug option to iterate.
- `useIpTimezone`: some anti-botting detects when your IP's timezone is different from the browser, this flag looks up the current IP (which is likely the proxy) and sets the timezone. note this can add 1-2 seconds to the scraper.

### Helpful best practices when writing scrapers

1. When running locally, a vnc server is started that can be controlled by visiting: http://127.0.0.1:8080/vnc.html
2. Start by a code block like the following and use Playwright's codegen to match selectors
   ```typescript
   log(sc, "*** paused (open browser to http://127.0.0.1:8080/vnc.html) ***")
   await sc.page.pause()
   ```
3. Put a `try`/`catch` block around your entire method when debugging to print the error and then `await sc.page.pause()` so you can investigate when things fail. Also consider a `sc.page.setDefaultTimeout(5000)` statement to not wait the full 30s Playwright expects.
4. Getting a scraper to be complete end-to-end in **5 seconds** is amazing, **5-10 seconds** is ok, **10-15 seconds** is ok, **15+ seconds** isn't great. Cache everything that you can, block outside vendors they're using (except anti-botting), try to directly do xhr requests instead of filling out forms (when possible). It's all a balance of the amount of anti-botting they're using.
5. If stuck behind anti-botting, try `useIpTimezone`.
6. If the xhr for the actual flight results takes a while to get requested, use `showFullRequest` to see when the request actually starts, maybe there's a dependent request that can be cached.