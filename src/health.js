var config = require('./config');
var status = require('./status');

/**
 * Checks if the server seems healthy. Set up to operate async (with callback) because we may likely want
 * to be able to add async checks, such as checking external services like s3, in the future.
 *
 * First param of callback is boolean indicating healthy state.
 * Second param of callback is the reason for failing health check. Will be undefined  if healthy.
 *
 * @param cb
 * @returns {*}
 */
exports.check = function(cb) {
    var statusInfo = status.getStatusInfo();

    // if queues contain more requests than can be processed in a reasonable amount of time, not healthy
    if (statusInfo.manipulations.currentQueueSize > (3 * statusInfo.manipulations.limit)) {
        return cb(false, 'Overloaded. Too many concurrent manipulations.');
    }
    if (statusInfo.proxyStreams.currentQueueSize > (5 * statusInfo.proxyStreams.limit)) {
        return cb(false, 'Overloaded. Too many concurrent proxy streams.');
    }

    cb(true);
};