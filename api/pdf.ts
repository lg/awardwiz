import type { VercelRequest, VercelResponse } from "@vercel/node"

const playwright = require("playwright-aws-lambda")

export default async function (req: VercelRequest, res: VercelResponse) {
  const browser = await playwright.launchChromium({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto("https://playwright.dev/")
  const title = await (await page.locator(".navbar__inner .navbar__title")).allTextContents()

  res.send(`Title is: ${title}!`)
}
