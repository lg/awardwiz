import { Listr } from "listr2"

export const runListrTask = async <T extends object>(title: string, task: () => Promise<T>, suffix?: (ret: T) => string) => {
  let ret: T
  await new Listr([{ title, task: async (ctx, taskObj) => {
    ret = await task()
    // eslint-disable-next-line no-param-reassign
    if (suffix) taskObj.title = `${taskObj.title} ${suffix(ret)}`
  } }], { registerSignalListeners: false, rendererOptions: { collapseErrors: false }}).run()
  return ret!
}
