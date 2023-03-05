import CDP from "chrome-remote-interface"
import { Bezier, Point } from "bezier-js"

export class Mouse {
  private curMousePos

  constructor(private client: CDP.Client, private viewportSize: number[], private debug: boolean) {
    this.curMousePos = [Math.random() * viewportSize[0]!, 0]  // start at top of viewport since that's where the URL bar would be
  }

  private async getBoxForSelector(selector: string) {
    const doc = await this.client.DOM.getDocument({ depth: -1 })
    const node = await this.client.DOM.querySelector({ nodeId: doc.root.nodeId, selector })
    if (!node.nodeId)
      throw new Error("couldnt get button")
    return await this.client.DOM.getBoxModel({ nodeId: node.nodeId })
  }

  private genPath(start: number[], end: number[]) {
    const EXTRA_BEZIER_POINTS = Math.floor(Math.random() * 2) + 1
    const TOTAL_POINTS = 80 + Math.floor(Math.random() * 20)
    const OVERSHOOT = 20 + (Math.random() * 10)

    if (start[0]! > this.viewportSize[0]! || start[1]! > this.viewportSize[1]! ||
        end[0]! > this.viewportSize[0]! || end[1]! > this.viewportSize[1]!)
      throw new Error("start or end point of area to click is outside of viewport")

    // Get the curve (using general method from https://github.com/Xetera/ghost-cursor)
    const bezier = new Bezier([
      { x: start[0]!, y: start[1]! },
      ...Array(EXTRA_BEZIER_POINTS).fill(0).map(() => ({
        x: Math.random() * (end[0]! - start[0]!) + start[0]!,
        y: Math.random() * (end[1]! - start[1]!) + start[1]!
      })),
      { x: end[0]!, y: end[1]! }
    ])

    // Apply the easing function as per https://incolumitas.com/2021/05/20/avoid-puppeteer-and-playwright-for-scraping/.
    // For more on the function, see https://easings.net/#easeOutElastic
    const c4 = (2 * Math.PI) / 3
    return Array(TOTAL_POINTS).fill(0).map((_, i) => {
      const t = i / TOTAL_POINTS + (Math.random() * (1 / TOTAL_POINTS) * 0.5)  // apply some jitter to which time we use
      const easedT = t === 0 || t === 1 ? t : Math.pow(2, -OVERSHOOT * t) * Math.sin((t * 10 - 0.75) * c4) + 1
      return bezier.get(easedT)
    })
  }

  private async plotPath(path: Point[]) {
    await this.client.Runtime.evaluate({ expression: `(() => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "${this.viewportSize[0]}");
      svg.setAttribute("height", "${this.viewportSize[1]}");
      svg.setAttribute("style", "position: fixed; top: 0; left: 0; z-index: 10000; pointer-events: none;");
      svg.innerHTML = \`${path.map((point, i) => {
        const color = i === path.length - 1 ? "red" : "lightgreen"
        return `<circle cx="${point.x}" cy="${point.y}" r="3" fill="${color}" stroke="black"  />`
      }).join("\n")}\`
      document.body.appendChild(svg);
    })()`})
  }

  private async moveMouseTo(pos: number[]) {
    const path = this.genPath(this.curMousePos, pos)
    if (this.debug)
      void this.plotPath(path)

    const lastTime = 0
    for (const [i, point] of path.entries()) {
      await this.wait((path[i] as unknown as { t: number }).t - lastTime)
      await this.client.Input.dispatchMouseEvent({ type: "mouseMoved", x: point.x, y: point.y })
    }
    this.curMousePos = pos
  }

  public async clickSelector(selector: string) {
    await this.wait(Math.random() * 100)

    const box = await this.getBoxForSelector(selector)
    const point = [(box.model.content[2]! - box.model.content[0]!) * Math.random() + box.model.content[0]!,
      (box.model.content[5]! - box.model.content[1]!) * Math.random() + box.model.content[1]!]
    await this.moveMouseTo(point)
    await this.wait(Math.random() * 100 + 50)
    await this.client.Input.dispatchMouseEvent({ type: "mousePressed", x: point[0]!, y: point[1]!, button: "left", clickCount: 1 })
    await this.wait(Math.random() * 100 + 50)
    await this.client.Input.dispatchMouseEvent({ type: "mouseReleased", x: point[0]!, y: point[1]!, button: "left", clickCount: 1 })
  }

  private async wait(ms: number) {
    // eslint-disable-next-line no-restricted-globals
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}
