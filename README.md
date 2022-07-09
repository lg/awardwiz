### Generating airlines.json
Make a request to: https://airlabs.co/api/v9/airlines?iata_code=&api_key=YOUR-API-KEY

### Running server side

Currently using browserless' docker container. It listens on port `4000`, no token.

```shell
docker-compose up
```

### Other interesting scrapers
https://github.com/SLF/MileageMonkey/blob/a38673723f4a1abf80919e421e36259aca3ca315/mm/zones.js