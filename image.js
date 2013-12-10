var config = require('./config');
var gm = require('gm');
var http = require('http');
var keyUtil = require('./key-util');
var semaphore = require('semaphore');
var storage = require('./storage');
var os = require('os');
var customOperations = require('./operations');

// If maxConcurrentManipulations is not provided, default to the number of CPUs.
// This is recommended for best performance anyway, so most users will not need
// to override this.
var maxConcurrentManipulations = config.maxConcurrentManipulations;
if (typeof(maxConcurrentManipulations) === 'undefined') {
    maxConcurrentManipulations = os.cpus().length;
}
console.log('Maximum concurrent manipulations: ' + maxConcurrentManipulations);

var sem = semaphore(maxConcurrentManipulations);

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

var parseOTFSteps = function(manipulation) {
    var operations = manipulation.split(':'),
        i, steps = [], parts;
    operations = operations.slice(1);
    for (i=0; i<operations.length; i++) {
        parts = operations[i].split(/[(),]/);
        parts.pop();
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

    if (isManipulationInProcess(s3DestKey)) {
        waitForManipulation(s3DestKey, function(err) {
            cb(err, true);
        });
        return;
    }

    startManipulation(s3DestKey);
    sem.take(function() {
        var req = http.request({
            host: srcHost,
            method: 'GET',
            path: srcPath
        });

        req.on('response', function(res){
            if (res.statusCode != 200) {
                return cb({name:'NoSuchKey'})
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
                    finishManipulation(s3DestKey, err);
                    sem.leave();
                    return;
                }
            }

            img.toBuffer(function(err, buffer) {
                if (err) {
                    cb(err);
                    finishManipulation(s3DestKey, err);
                    sem.leave();
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
                    finishManipulation(s3DestKey, err);
                    sem.leave();
                });
            });
        });

        req.end();
    });
};