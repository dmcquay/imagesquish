var config = require('./config');
var gm = require('gm');
var keyUtil = require('./key-util');
var semaphore = require('semaphore');
var storage = require('./storage');

var sem = semaphore(config.maxConcurrentManipulations || 2);

exports.doManipulation = function(bucket, imgId, manipulation, cb) {
    sem.take(function(done) {
        var srcKey = keyUtil.generateKey(bucket, imgId);
        var destKey = keyUtil.generateKey(bucket, imgId, manipulation);
        storage.getObject(srcKey, function(err, res) {
            var img = gm(res.Body);
            var steps = config.buckets[bucket].manipulations[manipulation];
            for (var i = 0; i < steps.length; i++) {
                step = steps[i];
                img[step.operation].apply(img, step.params);
            }

            img.toBuffer(function(err, buffer) {
                storage.upload({
                    data: buffer,
                    key: destKey,
                    contentType: res.ContentType
                }, function(err, s3res) {
                    cb(err);
                    sem.leave();
                });
            });
        });
    });
};