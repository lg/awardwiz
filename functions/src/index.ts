import * as functions from "firebase-functions"

exports.hello = functions.https.onCall((context) => {
  return undefined
})
