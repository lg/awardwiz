FROM mcr.microsoft.com/playwright:focal as build-image

# aws-lambda-ric build dependencies
RUN apt-get update && apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev \
  autoconf \
  libtool \
  build-essential \
  golang-go

RUN mkdir -p /function
WORKDIR /function

COPY add-cors.patch /root/add-cors.patch
RUN cd ~ \
  && git clone https://github.com/aws/aws-lambda-runtime-interface-emulator.git \
  && cd aws-lambda-runtime-interface-emulator \
  && patch -l cmd/aws-lambda-rie/http.go /root/add-cors.patch \
  && make compile-lambda-linux-all \
  && cp bin/aws-lambda-rie /usr/local/bin/aws-lambda-rie \
  && cd /function \
  && rm -rf ~/aws-lambda-runtime-interface-emulator

COPY function/package.json /function
RUN npm install
RUN npm install aws-lambda-ric
COPY ./function /function

RUN chmod 755 /usr/local/bin/aws-lambda-rie
COPY entrypoint.sh /
RUN chmod 755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["index.handler"]
