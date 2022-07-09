/* eslint-disable no-continue */
/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import { ElementHandle, Page } from "puppeteer"

export type ScraperFlowRule = {
  find: string
  type?: string
  selectValue?: string
  done?: true
  returnInnerText?: boolean
  andWaitFor?: string
  andDebugger?: true
  andThen?: ScraperFlowRule[]
  reusable?: boolean
  fail?: boolean
}

export const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) })
export const processScraperFlowRules = async (page: Page, rules: ScraperFlowRule[]) => {
  const skipIndexes: number[] = []

  const matchNextRule = async () => {
    if (skipIndexes.length === rules.length)
      return undefined
    const matchAll = async () => {
      const startTime = Date.now()

      while (true) {
        for (let i = 0; i < rules.length; i += 1) {
          if (skipIndexes.includes(i))
            continue
          let element: ElementHandle<Element> | null = null
          try {
            element = await page.$(rules[i].find)
          } catch (e) {
            // ignore error
          }

          if (!element)
            continue
          return { index: i, element }
        }
        await sleep(100)
        if (Date.now() - startTime > 10000)
          return undefined
      }
    }
    const match = await matchAll()
    if (!match)
      return undefined
    if (!rules[match.index].reusable)
      skipIndexes.push(match.index)
    return { element: match.element!, rule: rules[match.index] }
  }

  while (true) {
    const matchedRule = await matchNextRule()
    if (!matchedRule)
      break

    console.log("matched rule", matchedRule.rule.find)
    //await sleep(400)

    // Do not click on the element in certain cases
    if (!matchedRule.rule.selectValue)
      await matchedRule.element.click()

    if (matchedRule.rule.type) {
      await matchedRule.element.focus()
      await page.waitForTimeout(10)
      await page.keyboard.type(matchedRule.rule.type)
    }

    if (matchedRule.rule.selectValue) {
      await page.select(matchedRule.rule.find, matchedRule.rule.selectValue)
    }

    if (matchedRule.rule.andWaitFor)
      await page.waitForSelector(matchedRule.rule.andWaitFor)

    if (matchedRule.rule.andThen)
      await processScraperFlowRules(page, matchedRule.rule.andThen)

    if (matchedRule.rule.andDebugger)
      debugger

    if (matchedRule.rule.done)
      return matchedRule.element.evaluate((el: any) => el.innerText)

    if (matchedRule.rule.fail)
      throw new Error(await matchedRule.element.evaluate((el: any) => el.innerText))
  }

  return ""
}

export const pptrFetch = async (page: Page, url: string, init: RequestInit) => {
  // eslint-disable-next-line no-shadow
  return page.evaluate(async (url, init) => {
    const fetchResponse = await fetch(url, init)
    const resp = fetchResponse.text()
    return resp
  }, url, init)
}

export const isSaver = (airlineCode: string, fareCode: string) => {
  if (fareCode.length === 0)
    return undefined

  const table: {[airline: string]: string[]} = {
    "AA": ["T", "U", "X", "Z"]
  }

  if (table[airlineCode])
    return table[airlineCode].includes(fareCode[0])
  return undefined
}

export {}

// module.exports = hasPods
