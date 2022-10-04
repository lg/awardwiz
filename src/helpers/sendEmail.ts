import nodemailer from "nodemailer"

export const sendNotificationEmail = async (transporter: nodemailer.Transporter, template: HandlebarsTemplateDelegate, templateVars: { origin: string, destination: string, date: string }, toAddress: string) => {
  return transporter.sendMail({
    from: import.meta.env.VITE_SMTP_FROM_ADDRESS,
    to: toAddress,
    subject: "AwardWiz Notification",
    priority: "high",
    html: template(templateVars),
    attachments: [{
      filename: "wizard.png",
      path: "src/wizard.png",
      cid: "wizard.png",
    }]
  })
}
