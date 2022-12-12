import * as functions from "firebase-functions"
import type { Airport } from "../../src/types/scrapers"
const airports = require("../airports.json") as Airport[]
import cors from "cors"
import { find as findTz } from "geo-tz"

exports.airports = functions.https.onRequest((req, res) => {
  cors({ origin: true })(req, res, () => {
    res.set("Cache-control", "public, max-age=604800")
    res.status(200).json(airports.reduce<Record<string, Airport>>((newAirports, airport) => {
      if (airport.iata_code && airport.name && airport.iata_code.length === 3) {
        // eslint-disable-next-line no-param-reassign
        newAirports[airport.iata_code] = { ...airport, tz_name: findTz(airport.latitude, airport.longitude)[0] }
      }
      return newAirports
    }, {}))
  })
})
