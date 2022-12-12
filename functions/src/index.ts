import * as functions from "firebase-functions"
import cors from "cors"

exports.hello = functions.https.onRequest((req, res) => {
  cors({ origin: true })(req, res, () => {
    res.set("Cache-control", "public, max-age=604800")  // 1 week TTL
    res.status(200).json("hello!")
  })
})
