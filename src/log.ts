/* eslint-disable no-console */
import dayjs from "dayjs"
import c from "ansi-colors"

const origConsoleLog = console.log
export const logGlobal = (...args: any[]) => origConsoleLog(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}]`, ...args)
export const logWithId = (id: string, ...args: any[]) => origConsoleLog(`[${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")} ${colorFromId(id)(id)}]`, ...args)

const colorFromId = (id: string) => {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const allColors = [c.green, c.greenBright, c.yellow, c.yellowBright, c.blue, c.blueBright, c.magenta, c.magentaBright,
    c.cyan, c.cyanBright, c.white, c.whiteBright, c.gray]
  return allColors[hash % allColors.length]
}
