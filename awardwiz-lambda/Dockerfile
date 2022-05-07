ARG FUNCTION_DIR="/function"

FROM mcr.microsoft.com/playwright:focal as build-image
ARG FUNCTION_DIR

# aws-lambda-ric build dependencies
RUN apt-get update && apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev \
  autoconf \
  libtool

RUN mkdir -p ${FUNCTION_DIR}
WORKDIR ${FUNCTION_DIR}

# install playwright and amazon's layer
COPY package.json .
RUN npm install

COPY function/ ${FUNCTION_DIR}

FROM mcr.microsoft.com/playwright:focal
ARG FUNCTION_DIR

WORKDIR ${FUNCTION_DIR}
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

# Add Lambda Runtime Interface Emulator and use a script in the ENTRYPOINT for simpler local runs
ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
RUN chmod 755 /usr/local/bin/aws-lambda-rie
COPY entrypoint.sh /
RUN chmod 755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["index.handler"]
