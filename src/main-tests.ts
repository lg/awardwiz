import { chromium } from "playwright-extra"
import { gotoPage } from "./common.js"
import { DebugOptions, Scraper } from "./scraper.js"

const debugOptions: DebugOptions = {
  tracingPath: "./tmp/traces-tmp",
  saveAfterCaching: true
}

const scraper = new Scraper(chromium, debugOptions)
await scraper.create()

const dangers = await scraper.runAttempt(async (sc) => {
  sc.context?.setDefaultNavigationTimeout(120_000)
  sc.context?.setDefaultTimeout(120_000)

  await gotoPage(sc, "https://f.vision", "networkidle")

  sc.log("starting advanced tests")
  await sc.page.getByRole("link", { name: "Start advanced tests" }).click()
  sc.log("expanding things")
  await sc.page.getByRole("button", { name: "Expand All" }).click()

  sc.log("waiting for all tests to finish")
  await sc.page.waitForResponse("http://f.vision/index.php/soft_get").catch(() => { sc.log("timed out, but ok") })

  sc.log("done")

  const dangers = await sc.page.$$(".danger")
  let dangersClean = (await Promise.all(dangers.map((el) => el.innerText()))).map((t) => t.trim()).reduce<string[]>((acc, t) => {
    if (!acc.includes(t))
      acc.push(t)
    return acc
  }, [])

  // there's a bug on the website where it says there's a time zone mismatch when there isn't
  const ipTimezone = await sc.page.locator("#s_tz").innerText()
  const browserTimezone = await sc.page.locator("#b_tz").innerText()
  if (ipTimezone === browserTimezone)
    dangersClean = dangersClean.filter((t) => t !== "TIMEZONE")

  return dangersClean
}, { name: "test-fakevision", randomizeUserAgent: false }, `test-fakevision-${Math.random().toString(36).substring(2, 8)}`)

await scraper.destroy()

if (dangers.length > 0) {
  console.error("Dangers:", dangers)
  process.exit(1)
}

// eslint-disable-next-line no-console
console.log("No dangers found")
process.exit(0)

// const scraper = new Scraper(chromium, debugOptions)
// await scraper.create()

// const dangers = await scraper.runAttempt(async (sc) => {
//   sc.context?.setDefaultNavigationTimeout(120_000)
//   sc.context?.setDefaultTimeout(120_000)

//   await gotoPage(sc, "https://abrahamjuliot.github.io/creepjs/", "networkidle")

//   sc.log("done")
//   await sc.pause()

//   return "ok"
// }, { name: "test-creepjs", randomizeUserAgent: false }, `test-creepjs-${Math.random().toString(36).substring(2, 8)}`)

// await scraper.destroy()
