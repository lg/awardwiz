import express, { Response, NextFunction } from "express"
import { AwardWizScraperModule } from "./awardwiz-types.js"
import c from "ansi-colors"
import cors from "cors"
import { logger, logGlobal } from "./log.js"
import process from "node:process"
import { DebugOptions, runArkalis } from "../arkalis/arkalis.js"
import Bottleneck from "bottleneck"
import path from "node:path"
import { expressjwt, Request } from "express-jwt"
import * as dotenv from "dotenv"
import jwksRsa, { GetVerificationKey } from "jwks-rsa"
import rateLimit from "express-rate-limit"
dotenv.config()

const debugOptions: DebugOptions = {
  useProxy: true,
  globalBrowserCacheDir: process.env["TMP_PATH"] ? path.join(process.env["TMP_PATH"], "browser-cache") : "./tmp/browser-cache",
  browserDebug: false,
  showRequests: false,
  liveLog: (prettyLine: string, id: string) => logger.info(prettyLine, { id }),
  winston: logger,
  useResultCache: true,
  globalCachePath: process.env["TMP_PATH"] ? path.join(process.env["TMP_PATH"], "arkalis-cache") : "./tmp/arkalis-cache"
}

const SERVER_CONFIG = {
  serverPort: parseInt(process.env["PORT"] ?? "2222"),
  googleProjectId: process.env["GOOGLE_PROJECT_ID"] ?? "awardwiz",
  rateLimitMax: 100,
  rateLimitWindowMs: 60 * 60 * 1000,
  concurrentRequests: parseInt(process.env["CONCURRENT_REQUESTS"] ?? "5"),
  serviceWorkerJwtSecret: process.env["SERVICE_WORKER_JWT_SECRET"]
}

const app = express()

// Enable CORS
app.use(cors({ origin: true }))

// Simple unprotected endpoint
app.get("/", (req, res) => {
  res.send("Hello!\n")
})

// Authorize users via a JWT signed by Google
app.use(expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: "https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com"
  }) as GetVerificationKey,
  algorithms: ["RS256"],
  audience: SERVER_CONFIG.googleProjectId,
  issuer: `https://securetoken.google.com/${SERVER_CONFIG.googleProjectId}`
}))

// Alternatively, authorize service workers via secret-based HS256 jwt
// ex. { "sub": "marked-fares-worker", "email": "sw@awardwiz.com", "no-rl": true, "iat": 1516239022 }
if (SERVER_CONFIG.serviceWorkerJwtSecret) {
  app.use((err: any, req: Request, res: Response, next: NextFunction) => (err as { name: string }).name === "UnauthorizedError"
    ? void expressjwt({
        secret: SERVER_CONFIG.serviceWorkerJwtSecret!,
        algorithms: ["HS256"],
      })(req, res, next)
    : next(err))
} else {
  logGlobal(c.yellowBright("WARNING: No SERVICE_WORKER_JWT_SECRET provided, service workers will not be able to log in."))
}

// Log the request and stop if there was an error
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logGlobal("Received request:", c.magenta(req.url), c.red(`(${(err as Error).message})`))
  if ((err as Error).name === "UnauthorizedError") {
    res.status(401).send({ error: "Invalid authorization token" })
  } else {
    next(err)
  }
})
app.use((req: Request, res: Response, next: NextFunction) => {
  logGlobal("Received request:", c.magenta(req.url), "by", c.greenBright(`${req.auth!.sub!} (${req.auth!["email"] as string})`))
  next()
})

// Enforce rate limiting per user id (unless the no-rl flag is set on the jwt)
app.use(rateLimit({
  windowMs: SERVER_CONFIG.rateLimitWindowMs,
  max: SERVER_CONFIG.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.auth!["no-rl"] === true,
  keyGenerator: (req: Request) => req.auth!.sub!,
  handler: (req: Request, res: Response) => {
    logGlobal(c.red("Request rate limit exceeded:"), c.magenta(req.url), "by", c.greenBright(`${req.auth!.sub!} (${req.auth!["email"] as string})`))
    res.status(429).send({ error: "Too many requests" })
  }
}))

const limiter = new Bottleneck({ maxConcurrent: SERVER_CONFIG.concurrentRequests, minTime: 200 })
app.get("/run/:scraperName(\\w+)-:origin([A-Z]{3})-:destination([A-Z]{3})-:departureDate(\\d{4}-\\d{2}-\\d{2})", async (req: Request, res: Response) => {
  // Limit concurrency
  await limiter.schedule(async () => {
    const reqExtra = req as Request & { rateLimit?: { current: number, limit: number } }
    logGlobal("Processing request:", c.magenta(req.url), "by", c.greenBright(`${req.auth!.sub!} (${req.auth!["email"] as string})`), reqExtra.rateLimit ? c.whiteBright(`(${reqExtra.rateLimit.current}/${reqExtra.rateLimit.limit})`) : "")
    const { scraperName, origin, destination, departureDate } = req.params

    const scraper = await import(`./scrapers/${scraperName!}.js`) as AwardWizScraperModule
    const query = { origin: origin!, destination: destination!, departureDate: departureDate! }

    const cacheKey = scraperName === "fr24"
      ? `${scraper.meta.name}-${query.origin}${query.destination}`
      : `${scraper.meta.name}-${query.origin}${query.destination}-${query.departureDate.substring(5, 7)}${query.departureDate.substring(8, 10)}`

    const results = await runArkalis(async (arkalis) => {
      arkalis.log("Running scraper for", query)
      const scraperResults = await scraper.runScraper(arkalis, query)
      arkalis.log(c.green(`Completed with ${scraperResults.length} results`))
      return scraperResults
    }, debugOptions, scraper.meta, cacheKey)    // [2013-01-01 05:32:00.123 united-SFOLAX-0220-U7fw]

    res.contentType("application/json")
    res.status(results.result === undefined ? 500 : 200)
    res.end(JSON.stringify(results))
  })
})

const server = app.listen(SERVER_CONFIG.serverPort, () => {
  logGlobal(`Started Awardwiz HTTP server on port ${SERVER_CONFIG.serverPort}`)
})

process.on("SIGTERM", () => {
  logGlobal("Received SIGTERM, shutting down")
  server.close()
  logger.close()
  process.exit(0)
})

process.on("uncaughtException", function(err) {
  logGlobal(c.red("Uncaught exception, quitting:"), err)
  process.exit(1)
})
