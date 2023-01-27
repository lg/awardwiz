set dotenv-load

dockerarch := replace(replace(arch(), "aarch64", "arm64"), "x86_64", "amd64")
localtag := "awardwiz:scrapers"

[private]
default:
  @just --list

lets-upgrade-packages:
  npm exec -- npm-check -u

[private]
build:
  npm exec tsc

# build docker image for running locally
build-docker debug="1" tag=localtag platform=dockerarch: build
  docker buildx build -t {{tag}} --platform "linux/{{platform}}" --build-arg DEBUG={{debug}} ./

# build, deploy and run in prod
deploy-prod tag="registry.kub.lg.io:31119/awardwiz:scrapers2" platform="amd64" kubectl-deployment="-n lg deployment/awardwiz": (build-docker "0" tag platform)
  docker push {{tag}}
  kubectl rollout restart {{kubectl-deployment}}
  kubectl rollout status {{kubectl-deployment}}

# tail logs in production on k8s
tail-prod-logs:
  #!/bin/bash
  while true; do
    kubectl logs -l app=awardwiz --follow --all-containers --max-log-requests=50 --tail=5 | grep --line-buffered -v 'health-check'
    sleep 1
  done

[private]
run-docker extra="": build-docker
  docker run -it --rm -p 8282:8282 --volume $(pwd)/.env.local:/root/.env:ro --volume $(pwd)/tmp:/root/tmp {{extra}}

run-server: (run-docker "-p 2222:2222 -e PORT=2222 awardwiz:scrapers node dist/main-server.js")

run-debug scraper origin destination date:
  just run-docker "awardwiz:scrapers node dist/main-debug.js {{scraper}} {{origin}} {{destination}} {{date}}"

view-trace traceid:
  npx playwright -- show-trace tmp/traces/{{traceid}}.zip