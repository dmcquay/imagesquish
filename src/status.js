var concurrency = require('./concurrency');
var activeManipulations = require('./manipulations-status').activeManipulations;
var _ = require('underscore');

var manipulationsQueueSizes = [],
    streamQueueSizes = [],
    queueSizePollIntervalSeconds = 5,
    queueSizeTTLSeconds = 60 * 60 * 24, // 1 day
    queueSizesMaxLength = queueSizeTTLSeconds / queueSizePollIntervalSeconds;

// Keep track of the queue sizes over time so it can be reported.
setInterval(function() {
    manipulationsQueueSizes.push(concurrency.manipulationsSemaphore.getQueueLength());
    streamQueueSizes.push(concurrency.proxyStreamsSemaphore.getQueueLength());
    if (manipulationsQueueSizes.length > queueSizesMaxLength) {
        manipulationsQueueSizes.shift();
    }
    if (streamQueueSizes.length > queueSizesMaxLength) {
        streamQueueSizes.shift();
    }
}, queueSizePollIntervalSeconds * 1000);

var getAvgQueueSizeForLastXSeconds = function(queueSizes, seconds) {
    var itemCount = seconds / queueSizePollIntervalSeconds;
    var samples = queueSizes.slice(queueSizes.length - itemCount);
    var sum = _.reduce(samples, function(memo, num){ return memo + num; }, 0);
    return sum / samples.length;
};

var getAvgQueueSizes = function(queueSizes) {
    return {
        lastMinute: getAvgQueueSizeForLastXSeconds(queueSizes, 60),
        lastHour: getAvgQueueSizeForLastXSeconds(queueSizes, 60 * 60),
        lastDay: getAvgQueueSizeForLastXSeconds(queueSizes, 60 * 60 * 24)
    };
};

exports.getStatusInfo = function() {
    return {
        instanceName: process.env['IMAGESQUISH_INSTANCE_NAME'] || 'default',
        manipulations: {
            currentCount: concurrency.manipulationsSemaphore.current,
            limit: concurrency.manipulationsSemaphore.capacity,
            currentQueueSize: concurrency.manipulationsSemaphore.queue.length,
            averageQueueSizes: getAvgQueueSizes(manipulationsQueueSizes),
            activeManipulations: _.keys(activeManipulations.manipulations)
        },
        proxyStreams: {
            currentCount: concurrency.proxyStreamsSemaphore.current,
            limit: concurrency.proxyStreamsSemaphore.capacity,
            currentQueueSize: concurrency.proxyStreamsSemaphore.queue.length,
            averageQueueSizes: getAvgQueueSizes(streamQueueSizes)
        }
    }
};