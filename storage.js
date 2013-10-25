var AWS = require('aws-sdk');
var config = require('./config');
var http = require('http');
var log = require('./log');
var semaphore = require('semaphore');

var sem = semaphore(config.maxConcurrentProxyStreams || 2);

AWS.config.loadFromPath('./config/aws.json');
var s3 = new AWS.S3();

exports.getObject = function(key, cb) {
    var params = {
        Bucket: config.awsBucket,
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
        Bucket: config.awsBucket,
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

exports.proxyRequest = function(req, res, key, cb) {
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
            host: 's3.amazonaws.com',
            method: req.method,
            path: '/' + config.awsBucket + '/' + key,
            headers: req.headers
        });

        proxyReq.on('response', function(proxyRes) {
            var status = proxyRes.statusCode;
            if (status != 200 && status != 304 && cb) {
                cb('Proxy request returned non 200 response.');
                proxyReq.abort();
                leaveSem();
            } else {
                proxyRes.on('data', function(chunk) {
                    res.write(chunk, 'binary');
                });
                proxyRes.on('end', function() {
                    res.end();
                    if (cb) {
                        cb();
                    }
                    leaveSem();
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