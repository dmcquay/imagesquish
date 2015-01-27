FROM dockerfile/nodejs

MAINTAINER Dustin McQuay <dmcquay@gmail.com>

COPY . /data

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -q -y \
        graphicsmagick && \
    apt-get clean autoclean && \
    apt-get autoremove -y && \
    rm -rf /var/lib/{apt,dpkg,cache,log} && \
    rm -rf /var/lib/apt/lists/* && \
    npm install .

VOLUME ["/data", "/data/config"]

EXPOSE 3000

CMD node app.js