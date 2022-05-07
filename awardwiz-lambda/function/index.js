/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check

const { webkit, chromium, firefox } = require("playwright")
const fs = require("fs")

/**
 * @param {import("../../src/types/types").LambdaRequest} event
 * @param {import("aws-lambda").Context} context
 * @returns {Promise<any>}
 */
exports.handler = async (event, context) => {
  let browserName = event.browser || "chromium"
  const extraLaunchArgs = event.browserArgs || []
  const browserTypes = { webkit, chromium, firefox }
  const browserLaunchArgs = {
    webkit: [],
    chromium: ["--single-process"],
    firefox: []
  }

  if (Object.keys(browserTypes).indexOf(browserName) < 0) {
    console.log(`Browser '${browserName}' not supported, using chromium`)
    browserName = "chromium"
  }

  let browser = null
  let filePath = null
  let /** @type {import("../../src/types/types").LambdaResponse?} */ result = null

  try {
    console.log(`Starting browser: ${browserName}`)
    browser = await browserTypes[browserName].launch({
      args: [...browserLaunchArgs[browserName], ...extraLaunchArgs]
    })

    const browserContext = await browser.newContext()
    const page = await browserContext.newPage()

    filePath = `/tmp/request-${Date.now()}.js`
    fs.writeFileSync(filePath, event.code, { encoding: "utf-8" })
    console.log(`>>>>>>>>>> SCRIPT START ${filePath}`)

    /** @type {import("../../src/types/types").ScraperModule} */
    const script = require(filePath)
    /** @type {import("../../src/types/scrapers").ScraperResults} */
    const scraperResults = await script.run(page, event.context)
    result = { scraperResults }

    console.log(`<<<<<<<<<< SCRIPT END ${filePath}`)

  } catch (error) {
    console.log(`!!!!! Error: ${error}`)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
    if (filePath) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`Removing script file ${filePath}`)
      }
    }
  }

  return result
}
