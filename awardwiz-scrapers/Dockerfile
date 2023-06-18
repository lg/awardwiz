# hadolint global ignore=DL3016
#
# tags here: https://mcr.microsoft.com/en-us/product/playwright/tags
# use `docker pull <tag>` to locally cache metadata for playwright
FROM mcr.microsoft.com/playwright:v1.32.0
ENV CHROME_PATH=/ms-playwright/chromium-1055/chrome-linux/chrome
ARG DEBUG=0

# tools to debug via vnc (connect to this instance on port 8282)
ENV DISPLAY=:0.0
RUN apt-get update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt-get install --no-install-recommends -y \
  xvfb=2:1.20.* \
  && if [ $DEBUG = 1 ]; then apt-get install --no-install-recommends -y x11vnc=0.9.* novnc=1:1.0.* fluxbox=1.3.* ; fi \
  ; apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 8282

WORKDIR /usr/src/awardwiz
COPY package.json package-lock.json ./
RUN NODE_ENV=production npm install -g npm && npm i

# used for tests with vitest
COPY awardwiz-scrapers/ awardwiz-scrapers/
COPY arkalis/ arkalis/

COPY dist/ dist/
COPY awardwiz-scrapers/entrypoint.sh ./

ENTRYPOINT ["./entrypoint.sh"]
