FROM mcr.microsoft.com/playwright:v1.28.0-focal@sha256:005384a627bd71a0791e993d017907d31c9798e6b082d794a36e80213520c0a9
WORKDIR /root

# tools to debug via vnc (connect to this instance on port 8080)
ENV DISPLAY=:0.0
RUN apt update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt install -y x11vnc novnc xvfb fluxbox
EXPOSE 8080

# redis is used for caching urls
RUN curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list \
  && apt update && apt install -y redis

# code should already be available in dist/ as javascript
ENV NODE_ENV production
COPY package.json package-lock.json ./
RUN npm install -g npm && npm i

COPY dist/ dist/
COPY ua-*.txt run.sh ./

CMD ["/root/run.sh"]


