import * as functions from "firebase-functions"
import cors from "cors"
import puppeteer, { Browser } from "puppeteer"

let browser: Browser | undefined = undefined

exports.hello = functions.runWith({ memory: "2GB", timeoutSeconds: 60 }).https.onRequest((req, res) => {
  cors({ origin: true })(req, res, async () => {
    if (browser === undefined) {
      console.log("opening browser")
      browser = await puppeteer.launch({
        headless: false
      })
      console.log("opened")
    }

    console.log("waiting for new page")
    const page = await browser.newPage()
    console.log("navigating")
    await page.goto("https://www.github.com")

    console.log("getting title")
    const title = await page.title()
    console.log("good!")

    console.log("closing page")
    await page.close()

    //console.log("closing browser")

    // await browser.close()
    // console.log("done")

    //res.set("Cache-control", "public, max-age=604800")  // 1 week TTL
    console.log("done")
    res.status(200).json(title)
  })
})
