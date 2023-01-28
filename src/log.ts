/* eslint-disable no-console */
import winston from "winston"
import LokiTransport from "winston-loki"
import c from "ansi-colors"
import util from "util"
import os from "os"

const options: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        winston.format.printf(info => {
          info.message = prettifyArgs(info.message)
          info.message = highlightText(info.message)
          const id = info["labels"]?.id
          return `[${info["timestamp"]} ${id ? colorFromId(id)!(id) : "-"}] ${info.message}`
        })
      )
    })
  ]
}
export const logger = winston.createLogger(options)
if (process.env["LOKI_URL"] && process.env["LOKI_AUTH"]) {
  console.log("Logging to Loki")
  logger.add(new LokiTransport({
    host: process.env["LOKI_URL"],
    basicAuth: process.env["LOKI_AUTH"],
    labels: { "app": "awardwiz", "hostname": os.hostname() },
    format: winston.format.printf(info => prettifyArgs(info.message))
  }))
}

const HIGHLIGHT_WORDS = ["timeout", "anti-bot"]

const highlightText = (input: string) =>
  typeof input === "string" ? HIGHLIGHT_WORDS.reduce((acc, toRed) => acc.replace(new RegExp(toRed, "gi"), c.red(toRed.toUpperCase())), input) : input
const prettifyArgs = (args: any[]) =>
  args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")

export const logGlobal = (...args: any[]) => logger.info({ message: args })
export const logWithId = (id: string, ...args: any[]) => logger.info({ message: args, labels: { id } })

const colorFromId = (id: string) => {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const allColors = [c.green, c.greenBright, c.blue, c.blueBright, c.magenta, c.magentaBright, c.cyan, c.cyanBright,
    c.white, c.whiteBright, c.gray]
  return allColors[hash % allColors.length]
}
