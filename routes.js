var config = require('./config');
var newrelic = require('newrelic');
var health = require('./health');
var image = require('./image');
var keyUtil = require('./key-util');
var log = require('./log');
var proxy = require('./proxy');
var status = require('./status');

var S3_HOST = 's3.amazonaws.com';

exports.healthCheck = function(req, res) {
    newrelic.setTransactionName('HealthCheck');
    health.check(function(isHealthy, unhealthyReason) {
        var responseData = {
            healthy: isHealthy
        };
        if (!isHealthy) {
            responseData.unhealthyReason = unhealthyReason;
        }
        res.writeHead(isHealthy ? 200 : 503, {'content-type': 'application/json'});
        res.end(JSON.stringify(responseData));
    });
};

exports.status = function(req, res) {
    newrelic.setTransactionName('Status');
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify(status.getStatusInfo(), undefined, 2));
};

var proxyManipulatedImage = function(req, res, bucket, imgId, manipulation) {
    log.debug('beginning proxy of manipulated image');
    // check if the manipulated image already exists
    // if so, return it
    var buckets = config.get('buckets');
    var s3key = keyUtil.generateKey(bucket, imgId, manipulation);
    log.debug('s3key: ' + s3key);
    var s3Bucket = buckets[bucket].manipulationsS3Bucket;
    var manipulationPath = '/' + s3Bucket + '/' + s3key;
    newrelic.setTransactionName('Manipulation (cached)');
    proxy.proxyRequest(req, res, S3_HOST, manipulationPath, function(err) {
        if (err) {
            newrelic.setTransactionName('Manipulation:' + manipulation);
            log.debug('manipulated image not found. must generate.');
            // image wasn't found so we need to generate it
            image.doManipulation(bucket, imgId, manipulation, function(err, waited) {
                log.debug('manipulation completed, either success or failure');
                if (err) {
                    newrelic.setTransactionName('Operational Error');
                    if (err.name && err.name === 'ImageDoesNotExistAtOrigin') {
                        res.writeHead(404, {'content-type': 'text-plain'});
                        res.end('Image not found at origin. URL: ' + err.url);
                        log.logItems('error', ['get', bucket, imgId, manipulation, 'not found at ' + err.url]);
                    } else if (err.name && err.name === 'NoSuchOperation') {
                        res.writeHead(404, {'content-type': 'text-plain'});
                        res.end('Invalid operation found in this manipulation');
                        log.logItems('error', ['get', bucket, imgId, manipulation, 'invalid operation']);
                    } else {
                        res.writeHead(500, {'content-type': 'text-plain'});
                        res.end('Failed to process image: ' + err);
                        log.logItems('error', ['get', bucket, imgId, manipulation, 'failed']);
                    }
                } else {
                    if (waited) {
                        newrelic.setTransactionName('Wait:' + manipulation);
                    }
                    proxy.proxyRequest(req, res, S3_HOST, manipulationPath);
                    log.logItems('info', [
                        'get',
                        bucket,
                        imgId,
                        manipulation,
                        waited ? 'cached (waited)' : 'generated'
                    ]);
                }
            });
        } else {
            newrelic.setTransactionName('Cached');
            log.logItems('info', ['get', bucket, imgId, manipulation, 'cached']);
        }
    });
};

var get = exports.get = function (req, res) {
    log.info('GET ' + req.url);
    var bucket = req.params[0],
        manipulation = req.params[1],
        imgId = req.params[2];

    if (manipulation === 'original') {
        manipulation = null;
    }

    var path;
    log.debug('fetching bucket config');
    var bucketConfig = config.get('buckets')[bucket];

    if (!bucketConfig) {
        res.writeHead(400, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }
    log.debug('found bucket config');

    if (manipulation) {
        if (manipulation.indexOf('otf') === 0) {
            if (!bucketConfig.allowOTFManipulations) {
                newrelic.setTransactionName('Bad Request');
                res.writeHead(403, {'content-type': 'text/plain'});
                res.end('Bucket "' + bucket + '" does not allow on-the-fly manipulations.\n');
                return;
            }
        } else if (typeof(bucketConfig.manipulations[manipulation]) === 'undefined') {
            newrelic.setTransactionName('Bad Request');
            res.writeHead(404, {'content-type': 'text/plain'});
            res.end('Manipulation "' + manipulation + '" does not exist for bucket "' + bucket + '".\n');
            return;
        }
        proxyManipulatedImage(req, res, bucket, imgId, manipulation);
    } else {
        newrelic.setTransactionName('Original');
        path = '/' + bucketConfig.originPathPrefix + imgId;
        proxy.proxyRequest(req, res, bucketConfig.originHost, path);
        log.logItems('info', ['get', bucket, imgId, 'original']);
    }
};