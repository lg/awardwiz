set dotenv-load

dockerarch := replace(replace(arch(), "aarch64", "arm64"), "x86_64", "amd64")
localtag := "awardwiz:scrapers"

[private]
default:
  @just --list

[private]
build:
  npm exec tsc

# ⭐️ builds, lints, checks dependencies and runs tests (TODO: run tests)
check: build test
  TIMING=1 npm exec -- eslint --ext .ts --max-warnings=0 .
  docker run --rm -v $(pwd):/repo --workdir /repo rhysd/actionlint:latest -color
  docker run --rm -v $(pwd):/repo --workdir /repo hadolint/hadolint hadolint **/Dockerfile
  docker run --rm --platform linux/amd64 -v $(pwd):/repo --workdir /repo 3scale/ajv:latest -s config.schema.json -d config.json
  NODE_NO_WARNINGS=1 npm exec -- depcheck --ignores depcheck,npm-check,typescript,devtools-protocol,@types/har-format,@iconify/json,~icons,@vitest/coverage-c8,vite-node,node-fetch,geo-tz,@types/node-fetch,@svgr/plugin-jsx,typescript-json-schema
  @echo 'ok'

# runs the github actions, note that this needs a properly configured .env
check-with-act:
  act --job run-checks --rm
  act --job deploy --rm
  act --job marked-fares-worked --rm
  @echo 'ok'

test: build
  npm exec -- vitest run ./test/**/*.test.ts

# runs an interactive npm package update tool to get the latest versions of everything
lets-upgrade-packages:
  npm exec -- npm-check -u

##############################
# FRONTEND
##############################

# ⭐️ starts the vite frontend
run-vite args="": build
  npm exec -- vite --config awardwiz/vite.config.ts {{args}}

# generate .schema.json files from .ts files
gen-json-schemas: build
  npm exec -- typescript-json-schema tsconfig.json ScrapersConfig --topRef --noExtraProps | sed 's/import.*)\.//g' > config.schema.json

# generate statics from internet (used by Github Actions when deploying)
gen-statics:
  npm exec -- vite-node --config awardwiz/vite.config.ts awardwiz/workers/gen-statics.ts

# generate awardwiz/dist directory for frontend (used by Github Actions when deploying)
gen-frontend-dist:
  just run-vite build

# run the marked fares worker (looks at watches fares and sends notifications when availability changes)
run-marked-fares-worker:
  npm exec -- vite-node --config awardwiz/vite.config.ts awardwiz/workers/marked-fares.ts

##############################
# SCRAPERS
##############################

# build the scrapers docker image for running locally
[private]
build-docker debug="1" tag=localtag platform=dockerarch: build
  docker buildx build --file ./awardwiz-scrapers/Dockerfile -t {{tag}} --platform "linux/{{platform}}" --build-arg DEBUG={{debug}} ./

# 9229 is for node debugger, 8282 is for the vnc web server. be aware this uploads your .env file and tmp/ directory
[private]
run-docker extra="": build-docker
  docker run -it --rm -p 8282:8282 -p 9229:9229 --volume $(pwd)/.env:/usr/src/awardwiz/.env:ro --volume $(pwd)/tmp:/usr/src/awardwiz/tmp {{extra}}

# run the scrapers http server on port 2222 (make sure your .env has your config in there)
run-server:
  just run-docker "-p 2222:2222 -e PORT=2222 awardwiz:scrapers node --enable-source-maps dist/awardwiz-scrapers/main-server.js"

# ⭐️ starts a scraper in docker (ex. `just run-scraper aa SFO LAX 2023-12-01`)
run-scraper scraper origin destination date:
  just run-docker "awardwiz:scrapers node --enable-source-maps dist/awardwiz-scrapers/main-debug.js {{scraper}} {{origin}} {{destination}} {{date}}"

# starts a scraper in docker and breaks waiting for debugger (to be used with the vscode launch.json config)
run-scraper-brk scraper origin destination date:
  just run-docker "awardwiz:scrapers node --inspect-brk=0.0.0.0:9229 --enable-source-maps dist/awardwiz-scrapers/main-debug.js {{scraper}} {{origin}} {{destination}} {{date}}"

# runs live anti-botting tests online against a variety of websites bot fingerprinting websites (EXPERIMENTAL and still doesn't fully succeed)
run-live-botting-tests:
  just run-docker "awardwiz:scrapers node --enable-source-maps dist/arkalis/test-anti-botting.js"

# ⭐️ runs live scraper tests online against all supported websites
run-live-scraper-tests:
  just run-docker "awardwiz:scrapers npm exec -- vitest run"

##############################
# DEPLOYMENT (you probably don't need these, they're more for deploying awardwiz.com)
##############################

# build arkalis docker image
[private]
build-arkalis-docker:
  docker buildx build --platform=linux/amd64 --file ./arkalis/Dockerfile -t "arkalis" ./

# build, deploy and run in prod
[private]
deploy-prod tag="registry.kub.lg.io:31119/awardwiz:scrapers" platform="amd64" kubectl-deployment="-n awardwiz deployment/awardwiz": (build-docker "0" tag platform)
  docker push {{tag}}
  kubectl rollout restart {{kubectl-deployment}}
  kubectl rollout status {{kubectl-deployment}}

# tail logs in production on k8s
[private]
tail-prod-logs:
  #!/bin/bash
  while true; do
    kubectl logs -l app=awardwiz --follow --all-containers --max-log-requests=50 --tail=5 | grep --line-buffered -v 'health-check'
    sleep 1
  done

[private]
test-anti-botting-prod:
  @just build-docker "1" "registry.kub.lg.io:31119/awardwiz:test" "amd64"
  docker push "registry.kub.lg.io:31119/awardwiz:test"
  kubectl run arkalis-test-anti-botting \
    --rm --restart=Never --pod-running-timeout=30s --attach --stdin \
    --image=registry.kub.lg.io:31119/awardwiz:test --image-pull-policy=Always \
    -- node --enable-source-maps dist/arkalis/test-anti-botting.js
