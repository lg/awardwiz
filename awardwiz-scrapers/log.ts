/* eslint-disable no-console */
import winston from "winston"
import LokiTransport from "winston-loki"
import c from "ansi-colors"
import util from "util"
import os from "os"

const options: winston.LoggerOptions = {
  defaultMeta: { app: "awardwiz" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format((info) => info["noConsole"] ? false : info)(),
        winston.format((info) => ({ ...info, message: prettifyArgs(info.message as string) }))(),
        winston.format((info) => ({ ...info, message: highlightText(info.message as string) }))(),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        winston.format.printf(info => `[${info["timestamp"] as string} ${info["id"] ? colorFromId(info["id"] as string)!(info["id"] as string) : "-"}] ${info.message as string}`)
      )
    })
  ]
}
export const logger = winston.createLogger(options)
if (process.env["LOKI_URL"] && process.env["LOKI_AUTH"]) {
  logger.add(new LokiTransport({
    host: process.env["LOKI_URL"],
    basicAuth: process.env["LOKI_AUTH"],
    labels: { "app": "awardwiz", "hostname": os.hostname() },
    format: winston.format.json()
  }))
}

const HIGHLIGHT_WORDS = ["timeout", "anti-bot"]

const highlightText = (input: string) =>
  typeof input === "string" ? HIGHLIGHT_WORDS.reduce((acc, toRed) => acc.replace(new RegExp(toRed, "gi"), c.red(toRed.toUpperCase())), input) : input
export const prettifyArgs = (args: any[] | string) =>
  typeof args === "string" ? args : args.map((item: any) => typeof item === "string" ? item : util.inspect(item, { showHidden: false, depth: null, colors: true })).join(" ")

export const logGlobal = (...args: any[]) => logger.info({ message: args })

const colorFromId = (id: string) => {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const allColors = [c.green, c.greenBright, c.blue, c.blueBright, c.magenta, c.magentaBright, c.cyan, c.cyanBright,
    c.white, c.whiteBright, c.gray]
  return allColors[hash % allColors.length]
}
