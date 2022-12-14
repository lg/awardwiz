FROM mcr.microsoft.com/playwright:v1.28.0-focal
WORKDIR /root

RUN apt update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt install -y x11vnc

COPY package.json package-lock.json ./
RUN npm install -g npm && npm i

COPY tsconfig.json ./
COPY ./src/*.ts ./src/
RUN npm exec tsc

COPY ua-*.txt run.sh ./

ENV DISPLAY :0

ENTRYPOINT ["./run.sh"]
CMD ["dist/main.js"]
