import { Listr } from "listr2"

export const runListrTask = async <T extends object>(title: string, task: () => Promise<T>, suffix?: (returnValue: T) => string) => {
  let returnTask: T
  await new Listr([{ title, task: async (_context, taskObject) => {
    returnTask = await task()
    // eslint-disable-next-line no-param-reassign
    if (suffix) taskObject.title = `${taskObject.title} ${suffix(returnTask)}`
  } }], { registerSignalListeners: false, rendererOptions: { collapseErrors: false }}).run()
  return returnTask!
}
