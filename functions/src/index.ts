import * as functions from "firebase-functions"
import cors from "cors"
//import { chromium } from "playwright"
const util = require("node:util")
const exec = util.promisify(require("node:child_process").exec)
// const fs = require("fs")

exports.hello = functions.runWith({ memory: "4GB", timeoutSeconds: 60 }).https.onRequest((req, res) => {
  return cors({ origin: true })(req, res, async () => {
    //const out = exec("pwd")
    //if (!fs.existsSync("node_modules/playwright-core/.local-browsers")) {
      const { stdout, stderr } = await exec("npx playwright install")
      return res.status(200).json({stdout, stderr})
    //}

    //return res.status(200).json("exists")



    // const startTime = Date.now()
    // console.log("opening browser")
    // const browser = await chromium.launch()
    // console.log("opening context")
    // const context = await browser.newContext()
    // console.log("opening page")
    // const page = await context.newPage()
    // console.log("navigating")
    // await page.goto("https://www.github.com")

    // console.log("getting title")
    // const title = await page.title()
    // console.log("good!")

    // console.log("closing context")
    // await context.close()
    // console.log("closing browser")
    // await browser.close()

    // console.log("done")
    // return res.status(200).json({ title, totTime: Date.now() - startTime })
  })
})
