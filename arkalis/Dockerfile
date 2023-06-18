# hadolint global ignore=DL3029,DL3003
#
# this Dockerfile is incomplete for now. todo still: multiple archs, move in arkalis

FROM --platform=linux/amd64 ubuntu:jammy-20230425 AS browser_builder
ARG CHROMIUM_VERSION="112.0.5615.137"

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update && apt-get install --no-install-recommends -y python3=3.10.* sudo=1.9.* ca-certificates=20211016* \
    python3-pip=22.0.* build-essential=12.9* lsb-release=11.1.* vim=2:8.2.* curl=7.81.* git=1:2.34.* \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://chromium.googlesource.com/chromium/tools/depot_tools.git /usr/local/src/chromium_depot_tools
ARG PATH="$PATH:/usr/local/src/chromium_depot_tools"

WORKDIR /usr/local/src/chromium/
RUN for _ in 1 2 3; do fetch --nohooks --no-history chromium && break; done \
  && for _ in 1 2 3; do gclient sync --with_branch_heads --with_tags --no-history && break; done \
  && cd src \
  && git fetch --progress --depth=1 origin $CHROMIUM_VERSION && git checkout FETCH_HEAD -B $CHROMIUM_VERSION \
  && for _ in 1 2 3; do gclient sync --nohooks --no-history && break; done \
  && sed -i '/if package_exists snapcraft/,/fi/s/^/#/' ./build/install-build-deps.sh \
  && ./build/install-build-deps.sh \
  && gclient runhooks

RUN cd src \
  && gn gen out/Default --args='is_debug=false symbol_level=2 target_os="linux" target_cpu="x64"' \
  && autoninja -C out/Default chrome
