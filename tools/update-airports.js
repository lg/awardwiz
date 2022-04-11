/* eslint-disable */

// go to flightradar24 and then look in the localdb in the browser for "list.airports"
const https = require('https')
https.get("https://www.flightradar24.com/airports/list?version=0", resp => resp.pipe(fs.createWriteStream("public/uu.json")))

// and run this
let uu = JSON.parse(fs.readFileSync("public/uu.json", "utf8"))
let outArr = []
for (const key in uu) {
  const item = uu[key]
  outArr.push({
    icao_code: item[0],
    iata_code: item[1],
    name: item[2],
    latitude: item[3],
    longitude: item[4],
    url: item[5],
    popularity: item[6],
    city: item[7],
    country: item[8]
  })
}
let outArrSorted = outArr.sort((a, b) => a.popularity > b.popularity ? -1 : 1)    // sort by popularity
fs.writeFileSync("public/airports.json", JSON.stringify(outArrSorted, null, 2))
