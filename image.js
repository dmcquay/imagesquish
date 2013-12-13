var concurrency = require('./concurrency');
var config = require('./config');
var customOperations = require('./operations');
var gm = require('gm');
var http = require('http');
var keyUtil = require('./key-util');
var storage = require('./storage');

var parseOTFSteps = function(manipulation) {
    var operations = manipulation.split(':'),
        i, steps = [], parts;
    operations = operations.slice(1);
    for (i=0; i<operations.length; i++) {
        parts = operations[i].split(/[(),]/);
        if (parts[parts.length-1] === "") {
            parts.pop();
        }
        steps.push({
            "operation": parts.shift(),
            "params": parts
        })
    }
    return steps;
};

exports.doManipulation = function(bucket, imgId, manipulation, cb) {
    var s3DestKey = keyUtil.generateKey(bucket, imgId, manipulation);
    var s3DestBucket = config.buckets[bucket].manipulationsS3Bucket;

    var srcHost = config.buckets[bucket].originHost;
    var srcPath = '/' + (config.buckets[bucket].originPathPrefix || '') + imgId;

    if (concurrency.isManipulationInProcess(s3DestKey)) {
        concurrency.waitForManipulation(s3DestKey, function(err) {
            cb(err, true);
        });
        return;
    }

    concurrency.startManipulation(s3DestKey);
    concurrency.manipulationsSemaphore.take(function() {
        var req = http.request({
            host: srcHost,
            method: 'GET',
            path: srcPath
        });

        req.on('response', function(res){
            if (res.statusCode != 200) {
                return cb({
                    name: 'ImageDoesNotExistAtOrigin',
                    url: 'http://' + srcHost + srcPath
                })
            }
            var img = gm(res);
            var steps;
            if (manipulation.indexOf('otf') === 0) {
                steps = parseOTFSteps(manipulation);
            } else {
                steps = config.buckets[bucket].manipulations[manipulation];
            }
            for (var i = 0; i < steps.length; i++) {
                step = steps[i];
                if (customOperations[step.operation]) {
                    customOperations[step.operation].apply(img, step.params);
                } else if (img[step.operation]) {
                    img[step.operation].apply(img, step.params);
                } else {
                    cb({name:'NoSuchOperation'});
                    concurrency.finishManipulation(s3DestKey, err);
                    concurrency.manipulationsSemaphore.leave();
                    return;
                }
            }

            img.toBuffer(function(err, buffer) {
                if (err) {
                    cb(err);
                    concurrency.finishManipulation(s3DestKey, err);
                    concurrency.manipulationsSemaphore.leave();
                    return;
                }
                var uploadParams = {
                    bucket: s3DestBucket,
                    data: buffer,
                    contentType: res.headers['content-type'],
                    key: s3DestKey
                };
                storage.upload(uploadParams, function(err, s3res) {
                    cb(err);
                    concurrency.finishManipulation(s3DestKey, err);
                    concurrency.manipulationsSemaphore.leave();
                });
            });
        });

        req.end();
    });
};