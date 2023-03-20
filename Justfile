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

[private]
lint: build
  TIMING=1 npm exec -- eslint --ext .ts --max-warnings=0 --cache .

[private]
clean:
  npm clean-install
  rm -rf dist/ .eslintcache

check:
  @just lint
  NODE_NO_WARNINGS=1 npm exec -- depcheck --ignores depcheck,npm-check,typescript,arkalis,devtools-protocol
  @echo 'ok'

check-clean: clean check

# build docker image for running locally
build-docker debug="1" tag=localtag platform=dockerarch: build
  docker buildx build -t {{tag}} --platform "linux/{{platform}}" --build-arg DEBUG={{debug}} ./

# build, deploy and run in prod
deploy-prod tag="registry.kub.lg.io:31119/awardwiz:scrapers" platform="amd64" kubectl-deployment="-n awardwiz deployment/awardwiz": (build-docker "0" tag platform)
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
  docker run -it --rm -p 8282:8282 --volume $(pwd)/.env:/usr/src/awardwiz/.env:ro --volume $(pwd)/tmp:/usr/src/awardwiz/tmp {{extra}}

run-server:
  just run-docker "-p 2222:2222 -e PORT=2222 awardwiz:scrapers node --enable-source-maps dist/awardwiz-scrapers/main-server.js"

run-debug scraper origin destination date:
  just run-docker "awardwiz:scrapers node --enable-source-maps dist/awardwiz-scrapers/main-debug.js {{scraper}} {{origin}} {{destination}} {{date}}"

test-anti-botting:
  just run-docker "awardwiz:scrapers node --enable-source-maps dist/arkalis/test-anti-botting.js"

test-anti-botting-prod:
  @just build-docker "1" "registry.kub.lg.io:31119/awardwiz:test" "amd64"
  docker push "registry.kub.lg.io:31119/awardwiz:test"
  kubectl run arkalis-test-anti-botting \
    --rm --restart=Never --pod-running-timeout=30s --attach --stdin \
    --image=registry.kub.lg.io:31119/awardwiz:test --image-pull-policy=Always \
    -- node --enable-source-maps dist/arkalis/test-anti-botting.js
