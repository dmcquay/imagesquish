var config = require('./config');
var os = require('os');
var semaphore = require('semaphore');


var maxConcurrentProxyStreams = config.maxConcurrentProxyStreams || 20;
var proxyStreamsSemaphore = semaphore(maxConcurrentProxyStreams);
console.log("Maximum concurrent proxy streams: " + maxConcurrentProxyStreams);


// If maxConcurrentManipulations is not provided, default to the number of CPUs.
// This is recommended for best performance anyway, so most users will not need
// to override this.
var maxConcurrentManipulations = config.maxConcurrentManipulations;
if (typeof(maxConcurrentManipulations) === 'undefined') {
    maxConcurrentManipulations = os.cpus().length;
}
var manipulationsSemaphore = semaphore(maxConcurrentManipulations);
console.log('Maximum concurrent manipulations: ' + maxConcurrentManipulations);


module.exports = {
    proxyStreamsSemaphore: proxyStreamsSemaphore,
    manipulationsSemaphore: manipulationsSemaphore
};