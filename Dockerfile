# tags here: https://mcr.microsoft.com/en-us/product/playwright/tags
FROM mcr.microsoft.com/playwright:v1.29.2
WORKDIR /root
ARG DEBUG=0

# tools to debug via vnc (connect to this instance on port 8282)
ENV DISPLAY=:0.0
RUN apt update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt install -y xvfb
RUN if [ $DEBUG = 1 ]; then apt install -y x11vnc novnc fluxbox; fi
EXPOSE 8282

# redis is used for caching urls
RUN if [ $DEBUG = 1 ]; then curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list \
  && apt update && apt install -y redis; fi

# code should already be available in dist/ as javascript
ENV NODE_ENV production
COPY package.json package-lock.json ./
RUN npm install -g npm && npm i

COPY run.sh ./
COPY dist/ dist/

CMD ["/root/run.sh"]
