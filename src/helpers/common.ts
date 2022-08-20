/* eslint-disable promise/no-nesting */
export async function retry<T>(retries: number, fn: () => Promise<T>, err?: any): Promise<T> {
  await new Promise((resolve) => { setTimeout(resolve, (5 - retries) * 1000) })
  return !retries ? Promise.reject(err) : fn().catch((error) => retry(retries - 1, fn, error))
}
