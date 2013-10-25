var config = require('./config');
var keyUtil = require('./key-util');
var log = require('./log');
var image = require('./image');
var storage = require('./storage');
var util = require('util');
var uuid = require('node-uuid');

exports.upload = function(req, res) {
    req.length = parseInt(req.get('content-length'), 10);
    var bucket = req.params['bucket'];

    if (!config.buckets[bucket]) {
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }

    var imgId = uuid.v4();
    var uploadParams = {
        data: req,
        contentType: req.get('content-type'),
        key: keyUtil.generateKey(bucket, imgId)
    };
    storage.upload(uploadParams, function(err) {
        if (err) {
            res.writeHead(500, {'content-type': 'text/plain'});
            res.write("Failure. Here's the error:\n");
            res.write(util.inspect(err) + "\n");
            log.logItems('info', ['post', bucket, imgId, 'failed']);
        } else {
            res.writeHead(201, {
                'content-type': 'text/plain',
                'Location': '/' + bucket + '/' + imgId
            });
            log.logItems('info', ['post', bucket, imgId]);
        }
        res.end();
    });
};

var proxyManipulatedImage = function(req, res, bucket, imgId, manipulation) {
    // check if the manipulated image already exists
    // if so, return it
    var key = keyUtil.generateKey(bucket, imgId, manipulation);
    storage.proxyRequest(req, res, key, function(err) {
        if (err) {
            // image wasn't found so we need to generate it
            image.doManipulation(bucket, imgId, manipulation, function(err, waited) {
                if (err) {
                    res.writeHead(500, {'content-type': 'text-plain'});
                    res.end('Failed to process image: ' + err);
                    log.logItems('error', ['get', bucket, imgId, manipulation, 'failed']);
                } else {
                    storage.proxyRequest(req, res, key);
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
            log.logItems('info', ['get', bucket, imgId, manipulation, 'cached']);
        }
    });
};

exports.get = function (req, res) {
    var bucket = req.params['bucket'];
    var imgId = req.params['imgId'];
    var manipulation = req.params['manipulation'];

    if (!config.buckets[bucket]) {
        res.writeHead(400, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }

    if (manipulation && !config.buckets[bucket].manipulations[manipulation]) {
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('Manipulation "' + manipulation + '" does not exist for bucket "' + bucket + '".\n');
        return;
    }

    if (manipulation) {
        proxyManipulatedImage(req, res, bucket, imgId, manipulation);
    } else {
        storage.proxyRequest(req, res, keyUtil.generateKey(bucket, imgId));
        log.logItems('info', ['get', bucket, imgId, 'original']);
    }
};