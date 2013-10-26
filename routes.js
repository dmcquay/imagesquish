var config = require('./config');
var formidable = require('formidable');
var fs = require('fs');
var keyUtil = require('./key-util');
var log = require('./log');
var image = require('./image');
var storage = require('./storage');
var util = require('util');
var uuid = require('node-uuid');

var doUpload = function(req, res, data, contentType, bucket) {
    if (!config.buckets[bucket]) {
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('Bucket "' + bucket + '" does not exist.\n');
        return;
    }

    var imgId = uuid.v4();
    var uploadParams = {
        data: data,
        contentType: contentType,
        key: keyUtil.generateKey(bucket, imgId)
    };
    storage.upload(uploadParams, function(err) {
        var url = keyUtil.generateUrl(req, bucket, imgId);

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
            res.write(util.inspect(err) + "\n");
            log.logItems('info', ['post', bucket, imgId, 'failed']);
        } else {
            res.writeHead(201, {
                'content-type': responseContentType,
                'Location': url
            });
            res.write(JSON.stringify({
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
            }));
            log.logItems('info', ['post', bucket, imgId]);
        }
        res.end();
    });
};

var uploadMultipart = function(req, res) {
    var form = new formidable.IncomingForm();
    var bucket = req.params.bucket;
    form.parse(req, function(err, fields, files) {
        for (name in files) {
            var fileStream = fs.createReadStream(files[name].path);
            doUpload(req, res, fileStream, files[name].type, bucket);
            break; // we'll just ignore all but the first for now
        }
    });
};

var uploadRaw = function(req, res) {
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