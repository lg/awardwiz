<center>
<img src="arkalis.png" width="50%" />

# Arkalis

</center>

Minimal NodeJS library to scrape websites using Chromium. Tries diligently to avoid anti-botting systems and other fingerprinting techniques used by systems like Akamai.

### Some noteable anti-botting evasions:

- 🤖 Human-like mouse control (accelerating/decelerating cursor)
- 💎 Uses an undetectably cleaned-up Chromium browser
- 🐞 Can use different HTTP/SOCKS5 proxies per scraper
- 📺 Randomizes screen size, browser size, and browser position
- 🌎 Timezone simulation
- 🚔 Automated testing against Sannysoft, Incolumitas and CreepJS
- 🎭 It's not Puppeteer, Playwright or Selenium, uses CDP directly

### Conveniences for you:

- ☁️ Debug live via a NoVNC connection
- 💯 Simple API to block/intercept/wait-for URLs and HTML
- 🦠 Regexp block URLs from loading
- 📝 Easy results logging to Winston
- 🙌 Supports a globally shared cache that persists post-scrape
- ⚡️ Runs the browser and all components from memory
- 🔢 Measures all bandwidth used so you can optimize requests
- 🤡 Extensive retry support all throughout so crappy proxies work

### Coming soon:

- [ ] Human-like keyboard control too
- [ ] Ability to select browser and platform and it should pull up: DOM, JA3 Fingerprint, etc
- [ ] Timezone simulation based on proxy IP address

## Installing

```sh
npm i arkalis
```

## Example of how to use (TODO: TEST THIS)

```typescript
import { Arkalis } from "arkalis"

const query = { origin: "SFO", destination: "HNL", departureDate: "2023-09-09" }
const results = await Arkalis.run(async (arkalis) => {
  arkalis.goto(`https://www.jetblue.com/booking/flights?from=${query.origin}&to=${query.destination}&depart=${query.departureDate}`)
  const waitForResult = await arkalis.waitFor({
    "success": { type: "url", url: "https://jbrest.jetblue.com/lfs-rwb/outboundLFS" }
  })

  return JSON.parse(waitForResult.response?.body)
}

console.log(`there are ${results.results.length} flights between ${query.origin} and ${query.destination}`)
```

## Running a script

```sh
docker run -it --rm \
  --volume $(pwd)/tmp:/usr/src/awardwiz/tmp \
  awardwiz:scrapers \
  node --enable-source-maps dist/YOUR_SCRIPT.js
```

## Running botting tests

```sh
docker run -it --rm \
  awardwiz:scrapers \
  node --enable-source-maps dist/arkalis/test-anti-botting.js
```