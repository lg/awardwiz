set dotenv-load

dockerarch := replace(replace(arch(), "aarch64", "arm64"), "x86_64", "amd64")

[private]
default:
  @just --list

[private]
build-code:
  npm exec tsc

# build docker image for running locally
build-docker debug="1" tag="awardwiz:scrapers" platform=dockerarch: build-code
  docker buildx build -t {{tag}} --platform "linux/{{platform}}" --build-arg DEBUG={{debug}} ./

# build, deploy and run in prod
deploy-prod tag="registry.kub.lg.io:31119/awardwiz:scrapers2" platform="amd64" kubectl-deployment="-n lg deployment/awardwiz": (build-docker "0" tag platform)
  docker push {{tag}}
  kubectl rollout restart {{kubectl-deployment}}
  kubectl rollout status {{kubectl-deployment}}

# tail logs in production on k8s
tail-prod-logs k8s-app-name="awardwiz":
  #!/bin/sh
  while true; do
    kubectl logs -l app={{k8s-app-name}} --follow --all-containers --max-log-requests=50 --tail=5 | grep --line-buffered -v 'health-check'
    sleep 1
  done

[private]
run-docker extra="": build-docker
  docker run -it --rm -p 8282:8282 --volume $(pwd)/.env.local:/root/.env:ro --volume $(pwd)/tmp:/root/tmp {{extra}} awardwiz:scrapers

# main-server.ts (listens on port 2222)
run-server: (run-docker "-p 2222:2222 -e PORT=2222 -e SCRIPT=server")

# main-debug.ts
run-debug: (run-docker "-e SCRIPT=debug")

# main-tests.ts
run-tests: (run-docker "-e SCRIPT=tests")
