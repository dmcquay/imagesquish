var AWS = require('aws-sdk');
var config = require('./config');
var http = require('http');
var log = require('./log');
var semaphore = require('semaphore');

var maxConcurrentProxyStreams = config.maxConcurrentProxyStreams || 20;
var sem = semaphore(maxConcurrentProxyStreams);
console.log("Maximum concurrent proxy streams: " + maxConcurrentProxyStreams);

AWS.config.loadFromPath('./config/aws.json');
var s3 = new AWS.S3();

exports.getObject = function(bucket, key, cb) {
    var params = {
        Bucket: bucket,
        Key: key
    };
    s3.getObject(params, function(err, res) {
        cb(err, res);
    });
};

exports.upload = function(params, cb) {
    s3.putObject({
        ACL: 'public-read',
        Body: params.data,
        Bucket: params.bucket,
        Key: params.key,
        CacheControl: 'max-age=31536000', // 1 year
        ContentType: params.contentType
    }, function(err, res) {
        if (err) {
            cb(err, res);
        } else {
            cb();
        }
    });
};

exports.proxyRequest = function(req, res, host, path, cb) {
    sem.take(function() {
        var leftSem = false;
        var leaveSem = function() {
            if (!leftSem) {
                leftSem = true;
                sem.leave();
            }
        };

        // S3 will attempt to use the host header as the bucket name.
        // Don't do this. By omitting this header, S3 will grab the bucket
        // name from the first slash-delimited component of the Request-URI
        // path instead, which is what we want.
        delete req.headers['host'];

        var proxyReq = http.request({
            host: host,
            method: req.method,
            path: path,
            headers: req.headers
        });

        proxyReq.on('response', function(proxyRes) {
            var status = proxyRes.statusCode;
            if (status != 200 && status != 304 && cb) {
                proxyReq.abort();
                leaveSem();
                cb('Proxy request returned non 200 response.');
            } else {
                proxyRes.on('data', function(chunk) {
                    res.write(chunk, 'binary');
                });
                proxyRes.on('end', function() {
                    res.end();
                    leaveSem();
                    if (cb) {
                        cb();
                    }
                });
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
            }
            res.on('close', function() {
                proxyReq.abort();
                leaveSem();
            });
        });
        proxyReq.end();
    });
};