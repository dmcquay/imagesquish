var activeManipulations = require('./manipulations-status').activeManipulations;
var concurrency = require('./concurrency');
var config = require('./config');
var customOperations = require('./operations');
var gm = require('gm');
var http = require('http');
var keyUtil = require('./key-util');
var log = require('./log');
var storage = require('./storage');

var parseOTFSteps = exports.parseOTFSteps = function(manipulation) {
    var operations = manipulation.split(':'),
        i, steps = [], parts;
    operations = operations.slice(1);
    for (i=0; i<operations.length; i++) {
        parts = operations[i].split(/[(),]/);
        while (parts[parts.length-1] === "") {
            parts.pop();
        }
        steps.push({
            "operation": parts.shift(),
            "params": parts
        });
    }
    return steps;
};

exports.manipulate = function(img, manipulation, bucket) {
    log.debug('beginning local manipulation');
    var steps;
    if (manipulation.indexOf('otf') === 0) {
        steps = parseOTFSteps(manipulation);
    } else {
        steps = config.get('buckets')[bucket].manipulations[manipulation];
    }
    log.debug('prepared steps');
    for (var i = 0; i < steps.length; i++) {
        log.debug('performing step: ' + i);
        step = steps[i];
        if (customOperations[step.operation]) {
            customOperations[step.operation].apply(img, step.params);
        } else if (img[step.operation]) {
            img[step.operation].apply(img, step.params);
        } else {
            throw Error('NoSuchOperation');
        }
        log.debug('DONE performing step: ' + i);
    }
    log.debug('done with all manipulation steps');
    return img;
};

exports.uploadImage = function(img, s3Bucket, s3Key, contentType, cb) {
    log.debug('starting uploadImage function');
    img.toBuffer(function(err, buffer) {
        log.debug('image converted to buffer');
        if (err) {
            log.error('error converting image to buffer');
            return cb(err);
        }
        var uploadParams = {
            bucket: s3Bucket,
            data: buffer,
            contentType: contentType,
            key: s3Key
        };
        log.debug('uploading to s3');
        storage.upload(uploadParams, function(err) {
            log.debug('finished upload, or error');
            cb(err);
        });
    });
};

exports.doManipulation = function(bucket, imgId, manipulation, cb) {
    log.debug('beginning manipulation');
    var buckets = config.get('buckets');
    var s3DestKey = keyUtil.generateKey(bucket, imgId, manipulation);
    var s3DestBucket = buckets[bucket].manipulationsS3Bucket;

    var srcHost = buckets[bucket].originHost;
    var srcPath = '/' + (buckets[bucket].originPathPrefix || '') + imgId;

    if (activeManipulations.isActive(s3DestKey)) {
        activeManipulations.wait(s3DestKey, function(err) {
            cb(err, true);
        });
        return;
    }

    activeManipulations.queue(s3DestKey);
    concurrency.manipulationsSemaphore.take(function() {
        var leftSem = false;
        var leaveSem = function() {
            if (!leftSem) {
                leftSem = true;
                concurrency.manipulationsSemaphore.leave();
            }
        };

        // ensure we always leave the semaphore with a 30 second timeout
        setTimeout(leaveSem, 30000);

        activeManipulations.start(s3DestKey);
        log.debug('successfully took semaphore ' + s3DestKey);

        var alreadyDone = false;
        var done = function(err) {
            if (alreadyDone) {
                log.log('error', 'Reported a single manipulation as done more than once. This should never happen.');
                return;
            }
            activeManipulations.finish(s3DestKey, err);
            leaveSem();
            cb(err);
            alreadyDone = true;
        };

        var req = http.request({
            host: srcHost,
            method: 'GET',
            path: srcPath
        });

        req.on('response', function(res){
            if (res.statusCode != 200) {
                return done({
                    name: 'ImageDoesNotExistAtOrigin',
                    url: 'http://' + srcHost + srcPath
                });
            }
            log.debug('fetched original');

            var img = gm(res);
            try {
                img = exports.manipulate(img, manipulation, bucket);
            } catch (err) {
                return done({name:err.message});
            }
            log.debug('finished local image manipulation. uploading.');
            exports.uploadImage(img, s3DestBucket, s3DestKey, res.headers['content-type'], done);
        });

        req.end();
    });
};