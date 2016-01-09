FROM node:5.3.0

MAINTAINER Dustin McQuay <dmcquay@gmail.com>

COPY . /app

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -q -y \
        graphicsmagick && \
    apt-get clean autoclean && \
    apt-get autoremove -y && \
    rm -rf /var/lib/{apt,dpkg,cache,log} && \
    rm -rf /var/lib/apt/lists/* && \
    cd /app && \
    npm install .

EXPOSE 3000

WORKDIR /app

CMD ["node", "app.js"]
