// test with curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'

const { webkit, chromium, firefox } = require('playwright')

export async function handler(event, lambdaContext) {
  let browserName = event.browser || "chromium"
  const extraLaunchArgs = event.browserArgs || []
  const browserTypes = { webkit, chromium, firefox }
  const browserLaunchArgs = {
    webkit: [],
    chromium: ["--single-process"],
    firefox: []
  }

  let browser = null
  if (Object.keys(browserTypes).indexOf(browserName) < 0) {
    console.log(`Browser '${browserName}' not supported, using chromium`)
    browserName = "chromium"
  }

  try {
    console.log(`Starting browser: ${browserName}`)
    browser = await browserTypes[browserName].launch({
      args: browserLaunchArgs[browserName].concat(extraLaunchArgs),
    })

    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto("http://google.com/")

    console.log(`Page title: ${await page.title()}`)
  } catch (error) {
    console.log(`error: ${error}`)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
