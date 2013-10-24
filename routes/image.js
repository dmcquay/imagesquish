var formidable = require('formidable');
var util = require('util');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var httpProxy = require('http-proxy');
var http = require('http');
var gm = require('gm');
var konphyg = require('konphyg')(__dirname + '/../config');
var bucketConfig = konphyg('buckets');

var awsBucket = 'com-athlete-ezimg';

AWS.config.loadFromPath('./config/aws.json');
var s3 = new AWS.S3();

var generateKey = function(bucket, imgId, manipulation) {
    manipulation = manipulation || 'original';
    return bucket + '/' + imgId + '/' + manipulation;
};

var uploadToS3 = function(params, cb) {
    s3.putObject({
        ACL: 'public-read',
        Body: params.data,
        Bucket: awsBucket,
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

exports.upload = function(req, res) {
    req.length = parseInt(req.get('content-length'), 10);
    var bucket = req.params['bucket'];
    var imgId = uuid.v4();
    var uploadParams = {
        data: req,
        contentType: req.get('content-type'),
        key: generateKey(bucket, imgId)
    };
    uploadToS3(uploadParams, function(err) {
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

var proxyImageRequest = function(req, res, s3Key, cb) {
    var proxyReq = http.request({
        host: 's3.amazonaws.com',
        method: req.method,
        path: '/' + awsBucket + '/' + s3Key,
        headers: req.headers
    });

    proxyReq.on('response', function(proxyRes) {
        var status = proxyRes.statusCode;
        if (status != 200 && status != 304 && cb) {
            cb('Proxy request returned non 200 response.');
        } else {
            proxyRes.on('data', function(chunk) {
                res.write(chunk, 'binary');
            });
            proxyRes.on('end', function() {
                res.end();
                if (cb) {
                    cb();
                }
            });
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
        }
    });
    proxyReq.end();
};

var getImageData = function(bucket, imgId, cb) {
    var params = {
        Bucket: awsBucket,
        Key: generateKey(bucket, imgId)
    };
    s3.getObject(params, function(err, res) {
        cb(err, res);
    });
};

var proxyManipulatedImage = function(req, res, bucket, imgId, manipulation) {
    // check if the manipulated image already exists
    // if so, return it
    var key = generateKey(bucket, imgId, manipulation);
    proxyImageRequest(req, res, key, function(err) {
        if (err) {
            // image wasn't found so we need to generate it
            console.log('did not find manipulated image. generating...\n');
            doManipulation(bucket, imgId, manipulation, function(err) {
                if (err) {
                    res.writeHead(500, {'content-type': 'text-plain'});
                    res.end('Failed to process image: ' + err);
                } else {
                    proxyImageRequest(req, res, key);
                }
            });
        } else {
            console.log('image found, did not need to generate\n');
        }
    });

    // check if the manipulation is currently being performed
    // if so, wait for it, then return it

    // perform the manipulation
};

var doManipulation = function(bucket, imgId, manipulation, cb) {
    getImageData(bucket, imgId, function(err, res) {
        var img = gm(res.Body);

        var steps = bucketConfig[bucket].manipulations[manipulation],
            step;
        for (var i= 0; i < steps.length; i++) {
            step = steps[i];
            img[step.operation].apply(img, step.params);
        }

        img.toBuffer(function(err, buffer) {
            uploadToS3({
                data: buffer,
                key: generateKey(bucket, imgId, manipulation),
                contentType: res.ContentType
            }, function(err, s3res) {
                if (err) {
                    cb(err);
                } else {
                    cb(err);
                }
            });
        });
    });
};

exports.get = function (req, res) {
    var bucket = req.params['bucket'];
    var imgId = req.params['imgId'];
    var manipulation = req.params['manipulation'];
    if (manipulation) {
        proxyManipulatedImage(req, res, bucket, imgId, manipulation);
    } else {
        proxyImageRequest(req, res, generateKey(bucket, imgId));
    }
};