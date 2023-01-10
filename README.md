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

### Helpful best practices when writing scrapers

1. Most important rule: Try your best to not need to keep changing proxies because you get detected by anti-botting. Proxies are slow, unreliable and can get expensive. It's cheaper and easier to scale things by writing scrapers that don't get detected easily.
2. See the Javadoc comments in `scraper.ts`.
3. When running locally, a vnc server is started that can be controlled by visiting: http://127.0.0.1:8282/vnc.html
4. Use `pauseAfterError` and `pauseAfterRun` when writing the initial scraper code such that you can debug unexpected errors. This uses Playwright's `page.pause()` which shows the `codegen` tool that can help pick good selectors for the scraper rules. `sc.page.setDefaultTimeout(5000)` might be helpful at the beginning of your scraper too to fail quicker when things are missing.
5. Getting a scraper to be complete end-to-end in **5 seconds** is amazing, **5-10 seconds** is good, **10-15 seconds** is ok, **15+ seconds** isn't great. Cache everything that you can, block unnecessary outside vendors they're using, try to directly do xhr requests instead of filling out forms (when possible). It's all a balance of the amount of anti-botting they're using vs scraping speed. The more clever and thoughtful you are, the faster and more resilient the scraper will be.
6. If the xhr for the actual flight results takes a while to get requested, use `showFullRequest` to see when the request actually starts, maybe there's a dependent request that can be cached.
7. If stuck behind anti-botting, try: `useIpTimezone`, `useRandomUserAgent`, `useBrowsers`, etc
