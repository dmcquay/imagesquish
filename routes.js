var config = require('./config');
var formidable = require('formidable');
var fs = require('fs');
var keyUtil = require('./key-util');
var log = require('./log');
var image = require('./image');
var proxy = require('./proxy');
var status = require('./status');
var storage = require('./storage');
var util = require('util');
var uuid = require('node-uuid');

var S3_HOST = 's3.amazonaws.com';

exports.status = function(req, res) {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify(status.getStatusInfo(), undefined, 2));
};

var doUpload = function(req, res, data, contentType, bucket, redirect) {
    var buckets = config.get('buckets');
    if (!buckets[bucket]) {
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }

    if (!buckets[bucket].allowWrite) {
        res.writeHead(403, {'content-type': 'text/plain'});
        res.end('You are not permitted to perform this operation.\n');
        return;
    }

    var imgId = uuid.v4();
    var uploadParams = {
        bucket: buckets[bucket].originalsS3Bucket,
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
    log.debug('beginning proxy of manipulated image');
    // check if the manipulated image already exists
    // if so, return it
    var buckets = config.get('buckets');
    var s3key = keyUtil.generateKey(bucket, imgId, manipulation);
    log.debug('s3key: ' + s3key);
    var s3Bucket = buckets[bucket].manipulationsS3Bucket;
    var manipulationPath = '/' + s3Bucket + '/' + s3key;
    proxy.proxyRequest(req, res, S3_HOST, manipulationPath, function(err) {
        if (err) {
            log.debug('manipulated image not found. must generate.');
            // image wasn't found so we need to generate it
            image.doManipulation(bucket, imgId, manipulation, function(err, waited) {
                log.debug('manipulation completed, either success or failure');
                if (err) {
                    if (err.name && err.name === 'ImageDoesNotExistAtOrigin') {
                        res.writeHead(404, {'content-type': 'text-plain'});
                        res.end('Image not found at origin. URL: ' + err.url);
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
                    proxy.proxyRequest(req, res, S3_HOST, manipulationPath);
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
    log.debug('get was called');
    var bucket = req.params[0],
        manipulation = req.params[1],
        imgId = req.params[2];

    if (manipulation === 'original') {
        manipulation = null;
    }

    var path;
    log.debug('fetching bucket config');
    var bucketConfig = config.get('buckets')[bucket];

    if (!bucketConfig) {
        res.writeHead(400, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }
    log.debug('found bucket config');

    if (manipulation) {
        if (manipulation.indexOf('otf') === 0) {
            if (!bucketConfig.allowOTFManipulations) {
                res.writeHead(403, {'content-type': 'text/plain'});
                res.end('Bucket "' + bucket + '" does not allow on-the-fly manipulations.\n');
                return;
            }
        } else if (typeof(bucketConfig.manipulations[manipulation]) === 'undefined') {
            res.writeHead(404, {'content-type': 'text/plain'});
            res.end('Manipulation "' + manipulation + '" does not exist for bucket "' + bucket + '".\n');
            return;
        }
        proxyManipulatedImage(req, res, bucket, imgId, manipulation);
    } else {
        path = '/' + bucketConfig.originPathPrefix + imgId;
        proxy.proxyRequest(req, res, bucketConfig.originHost, path);
        log.logItems('info', ['get', bucket, imgId, 'original']);
    }
};