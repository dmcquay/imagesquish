"use strict";

import activeManipulations from './manipulations-status'
var concurrency = require('./concurrency');
import config from './config';
var customOperations = require('./operations');
var gm = require('gm');
var http = require('http');
var keyUtil = require('./key-util');
var log = require('./log');
import parseDefinition from './parse-definition'
var storage = require('./storage');

export function manipulate(img, manipulation, bucket) {
    log.debug('beginning local manipulation');
    let steps, step;
    if (manipulation.indexOf('otf') === 0) {
        steps = parseDefinition(manipulation);
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

/**
 * Makes sure that the given manipulation has been performed and then returns.
 * It is assumed that this manipulation was not already completed when calling this function.
 *
 * 1. Collect/calculate parameters.
 * 2. Check if this manipulation is already in progress. If it is, wait and then return.
 * 3. Queue the manipulation (for some other request that could hit step 2)
 * 4. Wait for our turn to do the manipulation (server can only do X at a time).
 * 5. Update the status to note that we started
 * 6. Fetch the original image data
 * 7. Load the image data into memory and define the manipulations (performed lazily later)
 * 8. Upload the image (async, manipulations performed lazily as the img buffer is read for uploading)
 *
 * @param bucket
 * @param imgId
 * @param manipulation
 */
export async function doManipulation(bucket, imgId, manipulation) {
    log.debug('beginning manipulation');
    var buckets = config.buckets;
    var s3DestKey = keyUtil.generateKey(bucket, imgId, manipulation);
    var s3DestBucket = buckets[bucket].s3CacheBucket;

    var srcHost = buckets[bucket].originHost;
    var srcPath = '/' + (buckets[bucket].originPathPrefix || '') + imgId;
    if (activeManipulations.isActive(s3DestKey)) {
        // TODO: add this once tested
        //await activeManipulations.wait(s3DestKey);
        return;
    }

    activeManipulations.queue(s3DestKey);
    await concurrency.manipulationsSemaphore.take();

    var leftSem = false;
    var leaveSem = function() {
        if (!leftSem) {
            leftSem = true;
            concurrency.manipulationsSemaphore.leave();
        }
    };

    //// ensure we always leave the semaphore with a 30 second timeout
    //setTimeout(leaveSem, 30000);
    // i had a 30 second time out where i left the semaphore
    // but it seems like i should do the whole done() step instead
    // is that safe?

    activeManipulations.start(s3DestKey);
    //log.debug('successfully took semaphore ' + s3DestKey);
    //
    //var alreadyDone = false;
    //var done = function(err) {
    //    if (alreadyDone) {
    //        log.log('error', 'Reported a single manipulation as done more than once. This should never happen.');
    //        return;
    //    }
    //    activeManipulations.finish(s3DestKey, err);
    //    leaveSem();
    //    alreadyDone = true;
    //};
    //
    //try {
    //    let data = await fetchOriginal(srcHost, srcPath);
    //    let img = gm(data);
    //    img = exports.manipulate(img, manipulation, bucket);
    //    await exports.uploadImage(img, s3DestBucket, s3DestKey, res.headers['content-type']);
    //    done();
    //} catch(err) {
    //    // TODO: if the manipulation step triggers an error, we need to transform the error
    //    // like this: `err = {name:err.message}`
    //    done(err);
    //}



    //
    //var req = http.request({
    //    host: srcHost,
    //    method: 'GET',
    //    path: srcPath
    //});
    //
    //req.on('response', function(res){
    //    if (res.statusCode != 200) {
    //        return done({
    //            name: 'ImageDoesNotExistAtOrigin',
    //            url: 'http://' + srcHost + srcPath
    //        });
    //    }
    //    log.debug('fetched original');
    //
    //    var img = gm(res);
    //    try {
    //        img = exports.manipulate(img, manipulation, bucket);
    //    } catch (err) {
    //        return done({name:err.message});
    //    }
    //    log.debug('finished local image manipulation. uploading.');
    //    exports.oldUploadImage(img, s3DestBucket, s3DestKey, res.headers['content-type'], done);
    //});
    //
    //req.end();
}

async function fetchOriginal(host, path) {
    var req = http.request({
        method: 'GET',
        host,
        path
    });

    return new Promise(function(resolve, reject) {
        req.on('response', function(res){
            if (res.statusCode != 200) {
                reject({
                    name: 'ImageDoesNotExistAtOrigin',
                    url: 'http://' + srcHost + srcPath
                });
            }
            log.debug('fetched original');
            resolve(res);
        });
    });
}