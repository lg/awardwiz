# tags here: https://mcr.microsoft.com/en-us/product/playwright/tags
FROM mcr.microsoft.com/playwright:v1.30.0
ENV CHROME_PATH=/ms-playwright/chromium-1045/chrome-linux/chrome
ARG DEBUG=0

# tools to debug via vnc (connect to this instance on port 8282)
ENV DISPLAY=:0.0
RUN apt update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt install -y xvfb
RUN if [ $DEBUG = 1 ]; then apt install -y x11vnc novnc fluxbox; fi
EXPOSE 8282

WORKDIR /usr/src/awardwiz
COPY package.json package-lock.json ./
RUN NODE_ENV=production npm install -g npm && npm i

COPY dist/ dist/
COPY src/ src/
COPY entrypoint.sh ./

ENTRYPOINT ["./entrypoint.sh"]
