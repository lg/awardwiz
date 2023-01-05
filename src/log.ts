/* eslint-disable no-console */
import dayjs from "dayjs"
import c from "ansi-colors"

const HIGHLIGHT_WORDS = ["timeout", "anti-bot"]

const origConsoleLog = console.log

const highlightText = (input: string) =>
  typeof input === "string" ? HIGHLIGHT_WORDS.reduce((acc, toRed) => acc.replace(new RegExp(toRed, "gi"), c.red(toRed.toUpperCase())), input) : input

export const logGlobal = (...args: any[]) => origConsoleLog(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}]`, ...args.map(highlightText))
export const logWithId = (id: string, ...args: any[]) => origConsoleLog(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")} ${colorFromId(id)(id)}]`, ...args.map(highlightText))

const colorFromId = (id: string) => {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const allColors = [c.green, c.greenBright, c.yellow, c.yellowBright, c.blue, c.blueBright, c.magenta, c.magentaBright,
    c.cyan, c.cyanBright, c.white, c.whiteBright, c.gray]
  return allColors[hash % allColors.length]
}
