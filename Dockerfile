FROM mcr.microsoft.com/playwright:v1.28.0-focal@sha256:005384a627bd71a0791e993d017907d31c9798e6b082d794a36e80213520c0a9
WORKDIR /root

RUN apt update && DEBIAN_FRONTEND="noninteractive" TZ="America/Los_Angeles" apt install -y x11vnc novnc xvfb fluxbox

RUN curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list
RUN apt update && apt install -y redis

ENV NODE_ENV production
COPY package.json package-lock.json ./
RUN npm install -g npm && npm i

RUN curl --compressed https://easylist.to/easylist/easylist.txt \
  https://easylist.to/easylist/easyprivacy.txt \
  https://secure.fanboy.co.nz/fanboy-cookiemonster.txt \
  https://easylist.to/easylist/fanboy-social.txt \
  https://secure.fanboy.co.nz/fanboy-annoyance.txt | cat > adblock.txt

COPY dist/ dist/
COPY ua-*.txt run.sh ./

ENV DISPLAY=:0.0

CMD ["/root/run.sh"]

EXPOSE 8080
