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
deploy tag="registry.kub.lg.io:31119/awardwiz:scrapers2" platform="amd64" kubectl-deployment="-n lg deployment/awardwiz": (build-docker "0" tag platform)
  docker push {{tag}}
  kubectl rollout restart {{kubectl-deployment}}
  kubectl rollout status {{kubectl-deployment}}

# builds and run in docker main-server
run-server port="2222" tag="awardwiz:scrapers": (build-docker "1" tag)
  docker run -it --rm -p {{port}}:{{port}} --volume $(pwd)/tmp:/root/tmp -e PORT={{port}} {{tag}}

# builds and run in docker main-debug
run-debug x11vncport="8282" tag="awardwiz:scrapers": build-docker
  docker run -it --rm -p {{x11vncport}}:{{x11vncport}} --volume $(pwd)/tmp:/root/tmp {{tag}}
