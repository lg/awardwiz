import nodemailer from "nodemailer"

export const sendNotificationEmail = async (transporter: nodemailer.Transporter, template: HandlebarsTemplateDelegate, templateVariables: { origin: string, destination: string, date: string }, toAddress: string) => {
  return transporter.sendMail({
    from: "\"AwardWiz\" <no-reply@awardwiz.com>",
    to: toAddress,
    subject: "AwardWiz Notification",
    priority: "high",
    html: template(templateVariables),
    attachments: [{
      filename: "wizard.png",
      path: "src/wizard.png",
      cid: "wizard.png",
    }]
  })
}
