import { chromium, firefox, webkit } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
chromium.use(StealthPlugin())

console.log("hi!")

const startTime = Date.now()
console.log("opening browser")
const browser = await chromium.launch()
console.log("opening context")
const context = await browser.newContext()
console.log("opening page")
const page = await context.newPage()
console.log("navigating")
await page.goto("https://www.github.com")

console.log("getting title")
const title = await page.title()
console.log("good!")

console.log("closing context")
await context.close()
console.log("closing browser")
await browser.close()

console.log("done")
console.log({ title, totTime: Date.now() - startTime })
