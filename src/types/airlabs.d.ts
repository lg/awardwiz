declare interface AirLabsSchedule {
  airline_iata: string | null
  airline_icao: string
  flight_number: string
  flight_iata: null | string
  flight_icao: string
  cs_airline_iata: string | null
  cs_flight_iata: string | null
  cs_flight_number: null | string
  dep_iata: string
  dep_icao: string
  dep_terminals: string[]
  dep_time: string
  dep_time_utc: string
  arr_iata: string
  arr_icao: string
  arr_terminals: string[] | null
  arr_time: null | string
  arr_time_utc: null | string
  duration: number | null
  days: string[]
  aircraft_icao: null | string
}

declare type AirLabsAirlineName = {
  icao_code: string
  iata_code: string
  name: string
}

declare type AirlineRoute = {
  origin: string
  destination: string
  airlineCode: string
  airlineName: string
}
