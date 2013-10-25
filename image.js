var config = require('./config');
var gm = require('gm');
var keyUtil = require('./key-util');
var semaphore = require('semaphore');
var storage = require('./storage');

var sem = semaphore(config.maxConcurrentManipulations || 2);

var customOperations = {
    squareCenterCrop: function(size) {
        return this.resize(size, size, "^").
            gravity("Center").
            extent(size, size);
    }
};

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

exports.doManipulation = function(bucket, imgId, manipulation, cb) {
    var srcKey = keyUtil.generateKey(bucket, imgId);
    var destKey = keyUtil.generateKey(bucket, imgId, manipulation);

    if (isManipulationInProcess(destKey)) {
        waitForManipulation(destKey, function(err) {
            cb(err, true);
        });
        return;
    }

    startManipulation(destKey);
    sem.take(function() {
        storage.getObject(srcKey, function(err, res) {
            var img = gm(res.Body);
            var steps = config.buckets[bucket].manipulations[manipulation];
            for (var i = 0; i < steps.length; i++) {
                step = steps[i];
                if (customOperations[step.operation]) {
                    customOperations[step.operation].apply(img, step.params);
                } else {
                    img[step.operation].apply(img, step.params);
                }
            }

            img.toBuffer(function(err, buffer) {
                storage.upload({
                    data: buffer,
                    key: destKey,
                    contentType: res.ContentType
                }, function(err, s3res) {
                    cb(err);
                    finishManipulation(destKey, err);
                    sem.leave();
                });
            });
        });
    });
};