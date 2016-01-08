var os = require('os');
var semaphore = require('semaphore');
var log = require('./log');


var maxConcurrentProxyStreams = process.env['MAX_CONCURRENT_PROXY_STREAMS'] || 20;
var proxyStreamsSemaphore = semaphore(maxConcurrentProxyStreams);
log.info("Maximum concurrent proxy streams: " + maxConcurrentProxyStreams);


// If maxConcurrentManipulations is not provided, default to the number of CPUs.
// This is recommended for best performance anyway, so most users will not need
// to override this.
var maxConcurrentManipulations = process.env['MAX_CONCURRENT_MANIPULATIONS'];
if (typeof(maxConcurrentManipulations) === 'undefined') {
    maxConcurrentManipulations = os.cpus().length;
}
var manipulationsSemaphore = semaphore(maxConcurrentManipulations);
log.info('Maximum concurrent manipulations: ' + maxConcurrentManipulations);


module.exports = {
    proxyStreamsSemaphore: proxyStreamsSemaphore,
    manipulationsSemaphore: manipulationsSemaphore
};