# tags here: https://mcr.microsoft.com/en-us/product/playwright/tags
FROM mcr.microsoft.com/playwright:v1.29.1
WORKDIR /root

# tools to debug via vnc (connect to this instance on port 8282)
ENV DISPLAY=:0.0
RUN apt update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt install -y x11vnc novnc xvfb fluxbox
EXPOSE 8282

# redis is used for caching urls
RUN curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list \
  && apt update && apt install -y redis

# code should already be available in dist/ as javascript
ENV NODE_ENV production
COPY package.json package-lock.json ./
RUN npm install -g npm && npm i

COPY run.sh ./
COPY dist/ dist/

CMD ["/root/run.sh"]
