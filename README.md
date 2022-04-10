### Generating airports.json
Make a request to: https://airlabs.co/api/v9/airports?iata_code=&api_key=YOUR-API-KEY

### Generating airlines.json
Make a request to: https://airlabs.co/api/v9/airlines?iata_code=&api_key=YOUR-API-KEY

### Running server side

Currently using browserless' docker container

```shell
docker run --rm -p 4000:3000 -e "MAX_CONCURRENT_SESSIONS=10" -e "ENABLE_CORS=true" browserless/chrome:latest
```