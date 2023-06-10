/* eslint-disable no-console */

import { MarkedFare } from "../components/SearchResults.js"
import dayjs from "dayjs"
import LocalizedFormat from "dayjs/plugin/localizedFormat.js"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"
import { Listr } from "listr2"
import { runListrTask } from "../helpers/common.js"
import nodemailer from "nodemailer"
import handlebars from "handlebars"
import notificationEmail from "../../emails/notification.html?raw"
import admin from "firebase-admin"

dayjs.extend(LocalizedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

const BETA_USERS = ["wJPoPRSeNzgt0tfWfMvwmCfg7bw2", "GscyHmuPQ1ZuxT3LiQxy0CSyDP73", "MAEGu1eBUqT3E2J05oN1w5jz8rN2", "CbTBZBSXXPauP3H8pDhfdfcsP6v1", "XkeRNaV7yebTB8n9emEs33Jrxp22"]

for (const key of ["VITE_SCRAPERS_URL"])
  if (!Object.keys(import.meta.env).includes(key)) throw new Error(`Missing ${key} environment variable`)

let app: admin.app.App
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  console.log("\u001B[33mUsing Firebase emulators\u001B[0m")
  process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
  process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "127.0.0.1:9099"
  app = admin.initializeApp({ projectId: "awardwiz" })

} else {
  if (!Object.keys(import.meta.env).includes("VITE_FIREBASE_SERVICE_ACCOUNT_JSON")) throw new Error("Missing VITE_FIREBASE_SERVICE_ACCOUNT_JSON environment variable")
  app = admin.initializeApp({ credential: admin.credential.cert(JSON.parse(import.meta.env.VITE_FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount) })
}

//////////////////////////////////////

await runListrTask("Cleaning up old marked fares...", async () => {
  const oldMarkedFares = await admin.firestore(app)
    .collection("marked_fares")
    .where("originTime", "<", Math.floor(Date.now() / 1000))
    .get()
  const batch = admin.firestore(app).batch()
  oldMarkedFares.forEach((oldMarkedFare) => batch.delete(oldMarkedFare.ref))
  return batch.commit()
}, (returnData) => `${returnData.length} removed`)

const markedFaresQuery = await runListrTask("Getting all marked fares for beta users...", async () => {
  return admin.firestore(app)
    .collection("marked_fares")
    .get()
}, (returnData) => `${returnData.size} found`)
const markedFares = markedFaresQuery.docs.map((doc) => ({ ...doc.data(), id: doc.id } as MarkedFare))
  .filter((markedFare) => BETA_USERS.includes(markedFare.uid!))

// Prep email transport
const { transporter, template } = await runListrTask("Creating email transport...", async () => {
  let transporter
  if (import.meta.env.VITE_SMTP_CONNECTION_STRING) {
    transporter = nodemailer.createTransport(import.meta.env.VITE_SMTP_CONNECTION_STRING)
  } else {
    const testAccount = await nodemailer.createTestAccount()  // use this one for testing
    transporter = nodemailer.createTransport(`${testAccount.smtp.secure ? "smtps" : "smtp"}://${testAccount.user}:${testAccount.pass}@${testAccount.smtp.host}:${testAccount.smtp.port}`)
  }

  await transporter.verify()
  const template = handlebars.compile(notificationEmail)
  return { transporter, template }
}, () => import.meta.env.VITE_SMTP_CONNECTION_STRING ? "using prod SMTP" : "\u001B[33musing test account\u001B[0m")

// Needs to be imported here because of some 'fs' hook happydom seems to do which breaks Firebase file opening in initializeApp
import { genQueryClient, search } from "../helpers/awardSearchStandalone.js"
const qc = genQueryClient() // Use the same query client for all searches for caching

await new Listr<object>(
  markedFares.map((markedFare) => ({
    title: `Querying ${markedFare.origin} to ${markedFare.destination} on ${markedFare.date} for ${markedFare.uid ?? "unknown user"}`,
    task: async (_context, task) => {
      const results = await search({ origins: [markedFare.origin], destinations: [markedFare.destination], departureDate: markedFare.date }, qc)
      const foundSaver = results.searchResults.some((result) =>
        result.flightNo === markedFare.checkFlightNo
        && result.fares.find((fare) => fare.cabin === markedFare.checkCabin && fare.isSaverFare))

      if ((markedFare.curAvailable ?? false) === foundSaver)
        return

      // eslint-disable-next-line no-param-reassign
      task.title = `${task.title}: ${markedFare.curAvailable ? "available" : "unavailable"} ➡️ ${foundSaver ? "available 🎉" : "unavailable 👎"}`

      return task.newListr<object>([{
        title: "Sending notification email...",
        task: async (_context2, task2) => {
          // TODO: make the buttons work and remove the email restriction above
          const user = await admin.auth(app).getUser(markedFare.uid!)
          const sendResult = await transporter.sendMail({
            from: "\"AwardWiz\" <no-reply@awardwiz.com>",
            to: `"${user.displayName ?? user.email!}" <${user.email!}>`,
            subject: "AwardWiz Notification",
            priority: "high",
            html: template({
              origin: markedFare.origin,
              destination: markedFare.destination,
              date: dayjs(markedFare.date).format("ddd ll"),
              cabin: `${markedFare.checkCabin.charAt(0).toUpperCase()}${markedFare.checkCabin.slice(1)}`,
              availability: foundSaver ? "AVAILABLE" : "UNAVAILABLE",
              availability_color: foundSaver ? "#00aa00" : "#aa0000"
            }),
            attachments: [{
              filename: "wizard.png",
              path: "src/wizard.png",
              cid: "wizard.png",
            }]
          })

          // eslint-disable-next-line no-param-reassign
          task2.title = `${task2.title} ${nodemailer.getTestMessageUrl(sendResult) || sendResult.response}`
        }
      }, {
        title: "Updating marked fare...",
        task: async (_context2, task2) => {
          if (!markedFare.id) throw new Error("Missing id for marked fare")
          const docRef = admin.firestore().doc(`marked_fares/${markedFare.id}`)
          await docRef.update("curAvailable", foundSaver)

          // eslint-disable-next-line no-param-reassign
          task2.title = `${task2.title} ok`
        }
     }], { rendererOptions: { collapse: false } })
    },
    retry: 3,
  })), { concurrent: 5, exitOnError: true, registerSignalListeners: false, rendererOptions: { collapseErrors: false } }
).run()

console.log("done")

process.exit(0)   // TODO: this shouldn't be needed, but there's a leak somewhere with the ReactQuery QueryClient or nearby
