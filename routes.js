var config = require('./config');
var formidable = require('formidable');
var fs = require('fs');
var keyUtil = require('./key-util');
var log = require('./log');
var image = require('./image');
var storage = require('./storage');
var util = require('util');
var uuid = require('node-uuid');

var doUpload = function(req, res, data, contentType, bucket, redirect) {
    if (!config.buckets[bucket]) {
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }

    if (!config.buckets[bucket].allowWrite) {
        res.writeHead(403, {'content-type': 'text/plain'});
        res.end('You are not permitted to perform this operation.\n');
        return;
    }

    var imgId = uuid.v4();
    var uploadParams = {
        bucket: config.buckets[bucket].originalsS3Bucket,
        data: data,
        contentType: contentType,
        key: keyUtil.generateKey(bucket, imgId)
    };
    storage.upload(uploadParams, function(err) {
        var url = keyUtil.generateUrl(req, bucket, imgId),
            result;

        // If file is uploaded using an iframe, the application/json content-type
        // will cause an undesired download dialog. In those cases, application/json
        // will not be found in the accept header.
        var responseContentType = 'text/plain';
        if (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1) {
            responseContentType = 'application/json';
        }

        if (err) {
            res.writeHead(500, {'content-type': 'text/plain'});
            res.write("Failure. Here's the error:\n");
            res.end(util.inspect(err) + "\n");
            log.logItems('info', ['post', bucket, imgId, 'failed']);
        } else {
            result = {
                files: [
                    {
                        name: imgId,
                        size: data.length,
                        url: url,
                        thumbnailUrl: url,
                        deleteUrl: url,
                        deleteType: 'DELETE'
                    }
                ]
            };
            if (redirect) {
                res.writeHead(302, {
                    Location: redirect.replace(
                        /%s/,
                        encodeURIComponent(JSON.stringify(result))
                    )
                });
                res.end();
            } else {
                res.writeHead(201, {
                    'content-type': responseContentType,
                    'Location': url
                });
                res.end(JSON.stringify());
            }
            log.logItems('info', ['post', bucket, imgId]);
        }
    });
};

var uploadMultipart = exports.uploadMultipart = function(req, res) {
    var form = new formidable.IncomingForm();
    var bucket = req.params.bucket;
    var redirectUrl;
    form.parse(req, function(err, fields, files) {
        for (name in files) {
            var fileStream = fs.createReadStream(files[name].path);
            doUpload(req, res, fileStream, files[name].type, bucket, fields.redirect);
            break; // we'll just ignore all but the first for now
        }
    });
};

var uploadRaw = exports.uploadRaw = function(req, res) {
    req.length = parseInt(req.get('content-length'), 10);
    var bucket = req.params.bucket;
    doUpload(req, res, req, req.get('content-type'), bucket);
};

exports.upload = function(req, res) {
    if (req.headers['content-type'].indexOf('multipart/form-data') !== -1) {
        return uploadMultipart(req, res);
    } else {
        return uploadRaw(req, res);
    }
};

var proxyManipulatedImage = function(req, res, bucket, imgId, manipulation) {
    // check if the manipulated image already exists
    // if so, return it
    var s3key = keyUtil.generateKey(bucket, imgId, manipulation);
    var s3Bucket = config.buckets[bucket].manipulationsS3Bucket;
    storage.proxyRequest(req, res, s3Bucket, s3key, function(err) {
        if (err) {
            // image wasn't found so we need to generate it
            image.doManipulation(bucket, imgId, manipulation, function(err, waited) {
                if (err) {
                    if (err.name && err.name === 'NoSuchKey') {
                        res.writeHead(404, {'content-type': 'text-plain'});
                        res.end('Image not found');
                        log.logItems('error', ['get', bucket, imgId, manipulation, 'not found']);
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
                    storage.proxyRequest(req, res, s3Bucket, s3key);
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

var get = exports.get = function (req, res) {
    var bucket = req.params['bucket'];
    var imgId = req.params['imgId'];
    var manipulation = req.params['manipulation'];
    var s3Bucket, s3Key;

    if (!config.buckets[bucket]) {
        res.writeHead(400, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }

    if (manipulation) {
        if (manipulation.indexOf('otf') === 0) {
            if (!config.buckets[bucket].allowOTFManipulations) {
                res.writeHead(403, {'content-type': 'text/plain'});
                res.end('Bucket "' + bucket + '" does not allow on-the-fly manipulations.\n');
                return;
            }
        } else if (!config.buckets[bucket].manipulations[manipulation]) {
            res.writeHead(404, {'content-type': 'text/plain'});
            res.end('Manipulation "' + manipulation + '" does not exist for bucket "' + bucket + '".\n');
            return;
        }
        proxyManipulatedImage(req, res, bucket, imgId, manipulation);
    } else {
        s3Bucket = config.buckets[bucket].originalsS3Bucket;
        s3Key = keyUtil.generateKey(bucket, imgId);
        storage.proxyRequest(req, res, s3Bucket, s3Key);
        log.logItems('info', ['get', bucket, imgId, 'original']);
    }
};

exports.getUnmanaged = function (req, res) {
    var manipulation = req.params[1];
    if (manipulation === 'original') {
        manipulation = null;
    }
    req.params = {
        bucket: req.params[0],
        imgId: req.params[2],
        manipulation: manipulation
    };
    return get(req, res);
};