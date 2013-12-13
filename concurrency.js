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

// Avoid duplicate manipulations by detecting if the needed manipulation
// is already in progress.
var inProcessManipulations = {};
var startManipulation = function(key) {
    inProcessManipulations[key] = [];
};
var finishManipulation = function(key, err) {
    for (var i = 0; i < inProcessManipulations[key].length; i++) {
        inProcessManipulations[key][i](err);
    }
    delete inProcessManipulations[key];
};
var isManipulationInProcess = function(key) {
    return typeof(inProcessManipulations[key]) !== 'undefined';
};
var waitForManipulation = function(key, cb) {
    inProcessManipulations[key].push(cb);
};


module.exports = {
    proxyStreamsSemaphore: proxyStreamsSemaphore,
    manipulationsSemaphore: manipulationsSemaphore,
    startManipulation: startManipulation,
    finishManipulation: finishManipulation,
    isManipulationInProcess: isManipulationInProcess,
    waitForManipulation: waitForManipulation,
    inProcessManipulations: inProcessManipulations
};