"use strict";

var os = require('os');
var semaphore = require('semaphore');
var log = require('./log');

class PromiseSemaphore {
    constructor(capacity) {
        this.semaphore = semaphore(capacity)
    }

    async take() {
        let self = this;
        return new Promise(function (resolve) {
            self.semaphore.take(() => {
                resolve();
            });
        });
    }

    leave() {
        this.semaphore.leave();
    }

    getQueueLength() {
        return this.semaphore.queue.length;
    }

    getCurrent() {
        return this.semaphore.current;
    }
}

var maxConcurrentProxyStreams = process.env['MAX_CONCURRENT_PROXY_STREAMS'] || 20;
var proxyStreamsSemaphore = new PromiseSemaphore(maxConcurrentProxyStreams);
log.info("Maximum concurrent proxy streams: " + maxConcurrentProxyStreams);


// If maxConcurrentManipulations is not provided, default to the number of CPUs.
// This is recommended for best performance anyway, so most users will not need
// to override this.
var maxConcurrentManipulations = process.env['MAX_CONCURRENT_MANIPULATIONS'];
if (typeof(maxConcurrentManipulations) === 'undefined') {
    maxConcurrentManipulations = os.cpus().length;
}
var manipulationsSemaphore = new PromiseSemaphore(maxConcurrentManipulations);
log.info('Maximum concurrent manipulations: ' + maxConcurrentManipulations);


module.exports = {
    proxyStreamsSemaphore: proxyStreamsSemaphore,
    manipulationsSemaphore: manipulationsSemaphore
};