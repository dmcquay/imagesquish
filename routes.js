var config = require('./config').config;
var keyUtil = require('./key-util');
var image = require('./image');
var storage = require('./storage');
var util = require('util');
var uuid = require('node-uuid');

exports.upload = function(req, res) {
    req.length = parseInt(req.get('content-length'), 10);
    var bucket = req.params['bucket'];
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
        } else {
            res.writeHead(201, {
                'content-type': 'text/plain',
                'Location': '/' + bucket + '/' + imgId
            });
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
            image.doManipulation(bucket, imgId, manipulation, function(err) {
                if (err) {
                    res.writeHead(500, {'content-type': 'text-plain'});
                    res.end('Failed to process image: ' + err);
                } else {
                    storage.proxyRequest(req, res, key);
                }
            });
        }
    });

    // check if the manipulation is currently being performed
    // if so, wait for it, then return it

    // perform the manipulation
};

exports.get = function (req, res) {
    var bucket = req.params['bucket'];
    var imgId = req.params['imgId'];
    var manipulation = req.params['manipulation'];
    if (manipulation) {
        proxyManipulatedImage(req, res, bucket, imgId, manipulation);
    } else {
        storage.proxyRequest(req, res, keyUtil.generateKey(bucket, imgId));
    }
};