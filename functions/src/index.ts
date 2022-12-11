import * as functions from "firebase-functions"
import type { Airport } from "../../src/types/scrapers"
const airports = require("../airports.json") as Airport[]
import cors from "cors"

exports.airports = functions.https.onRequest((req, res) => {
  cors({ origin: true })(req, res, () => {
    res.set("Cache-control", "public, max-age=604800")
    res.json(airports.reduce<Record<string, Airport>>((newAirports, airport) => {
      if (airport.iata_code && airport.name && airport.iata_code.length === 3) {
        // eslint-disable-next-line no-param-reassign
        newAirports[airport.iata_code] = airport
      }
      return newAirports
    }, {}))
  })
})
