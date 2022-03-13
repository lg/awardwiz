declare type Airport = { country_code: string; iata_code: string; icao_code: string; lat: number; lng: number; name: string}
declare type AirportWithDistance = Airport & { distance: number}
