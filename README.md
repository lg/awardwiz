# Creating new scrapers

### Example template

```typescript
import { ScraperMetadata } from "../scraper.js"
import { AwardWizScraper, FlightWithFares } from "../types.js"

export const meta: ScraperMetadata = {
  name: "your-scraper-name",
  blockUrls: ["*.liveperson.net"],
  forceCache: ["*.svg", "*.chunk.js"]
}

export const runScraper: AwardWizScraper = async (sc, query) => {
  await gotoPage(sc, "https://www.google.com", "networkidle")

  log(sc, "hello!")

  const flightsWithFares: FlightWithFares[] = []
  return flightsWithFares
}
```

### ScraperMetadata

- `name`: the scraper name (required).
- `noBlocking`: by default will auto-block easylist and other similar lists (see blocking.ts), this disables that.
- `blockUrls`: blocks urls (as per Adblock format). use `showBlocked` debug option to iterate.
- `forceCache`: some websites don't return proper cache headers, this forces matching globs to get cached. use `showUncached` debug option to iterate.
- `unsafeHttpsOk`: when using proxies, some slyly try to mitm to see what you're doing. do not turn this on unless you're only scraping publicly info.
- `noIpLookup`: by default the scraper assumes a proxy is being used, so it looks up it's ip and timezone and sets the browser timezone accordingly. this can be slow, so this flag is used to disable it, though some websites will detect this as botting.

### Helpful best practices when writing scrapers

1. When running locally, a vnc server is started that can be controlled by visiting: http://127.0.0.1:8080/vnc.html
2. Start by a code block like the following and use Playwright's codegen to match selectors
   ```typescript
   log(sc, "*** paused (open browser to http://127.0.0.1:8080/vnc.html) ***")
   await sc.page.pause()
   ```
3. Put a `try`/`catch` block around your entire method when debugging to print the error and then `await sc.page.pause()` so you can investigate when things fail. Also consider a `sc.page.setDefaultTimeout(5000)` statement to not wait the full 30s Playwright expects.
4. Getting a scraper to be complete end-to-end in **5 seconds** is amazing, **5-10 seconds** is ok, **10-15 seconds** is ok, **15+ seconds** isn't great. Cache everything that you can, block outside vendors they're using (except anti-botting), try to directly do xhr requests instead of filling out forms (when possible). It's all a balance of the amount of anti-botting they're using.