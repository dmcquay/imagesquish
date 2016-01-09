"use strict";

var activeManipulations = require('./manipulations-status').activeManipulations;
var concurrency = require('./concurrency');
import config from './config';
var customOperations = require('./operations');
var gm = require('gm');
var http = require('http');
var keyUtil = require('./key-util');
var log = require('./log');
var storage = require('./storage');

export function parseOTFSteps(manipulation) {
    let operations = manipulation.split(':'),
        steps = [], parts;
    operations = operations.slice(1);
    for (let operation of operations) {
        parts = operation.split(/[(),]/);
        while (parts[parts.length-1] === "") {
            parts.pop();
        }
        steps.push({
            "operation": parts.shift(),
            "params": parts
        });
    }
    return steps;
}

export function manipulate(img, manipulation, bucket) {
    log.debug('beginning local manipulation');
    let steps, step;
    if (manipulation.indexOf('otf') === 0) {
        steps = parseOTFSteps(manipulation);
    } else {
        steps = config.get('buckets')[bucket].manipulations[manipulation];
    }
    log.debug('prepared steps');
    steps.forEach((step, idx) => {
        log.debug('performing step: ' + idx);
        if (customOperations[step.operation]) {
            customOperations[step.operation].apply(img, step.params);
        } else if (img[step.operation]) {
            img[step.operation].apply(img, step.params);
        } else {
            throw Error('NoSuchOperation');
        }
        log.debug('DONE performing step: ' + idx);
    });
    log.debug('done with all manipulation steps');
    return img;
}

export function uploadImage(img, s3Bucket, s3Key, contentType) {
    return new Promise(function(resolve, reject) {
        log.debug('starting uploadImage function');
        img.toBuffer(function(err, buffer) {
            log.debug('image converted to buffer');
            if (err) {
                log.error('error converting image to buffer');
                reject(err);
            }
            let uploadParams = {
                bucket: s3Bucket,
                data: buffer,
                contentType: contentType,
                key: s3Key
            };
            log.debug('uploading to s3');
            storage.upload(uploadParams, function(err) {
                log.debug('finished upload, or error');
                err ? reject(err) : resolve();
            });
        });
    });
}

// temporary for backwards compatibility
export function oldUploadImage(img, s3Bucket, s3Key, contentType, cb) {
    uploadImage(img, s3Bucket, s3Key, contentType).then(cb).catch(cb);
}

export function doManipulation(bucket, imgId, manipulation, cb) {
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
            exports.oldUploadImage(img, s3DestBucket, s3DestKey, res.headers['content-type'], done);
        });

        req.end();
    });
}