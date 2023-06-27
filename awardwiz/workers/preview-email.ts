/* eslint-disable no-console */

import nodemailer from "nodemailer"
import handlebars from "handlebars"
import notificationEmail from "../emails/notification.html?raw"

console.log("creating test account")
const testAccount = await nodemailer.createTestAccount()  // use this one for testing

console.log("verifying transport")
//const transporter = nodemailer.createTransport(import.meta.env.VITE_SMTP_CONNECTION_STRING)   // use this one for production
const transporter = nodemailer.createTransport(`${testAccount.smtp.secure ? "smtps" : "smtp"}://${testAccount.user}:${testAccount.pass}@${testAccount.smtp.host}:${testAccount.smtp.port}`)
await transporter.verify()

console.log("compiling template")
const template = handlebars.compile(notificationEmail)

console.log("sending email")
const info = await transporter.sendMail({
  from: "\"AwardWiz\" <no-reply@awardwiz.com>",
  to: "trivex@gmail.com",
  subject: "AwardWiz Notification",
  priority: "high",
  html: template({
    origin: "SFO",
    destination: "LIH",
    date: "Dec 10, 2022"
  }),
  attachments: [{
    filename: "wizard.png",
    path: "src/wizard.png",
    cid: "wizard.png",
  }]
})

console.log("Message sent: %s", info.messageId)
console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
