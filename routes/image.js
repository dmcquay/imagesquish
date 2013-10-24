var formidable = require('formidable');
var util = require('util');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var httpProxy = require('http-proxy');
var http = require('http');
var gm = require('gm');

var bucket = 'com-athlete-ezimg';

AWS.config.loadFromPath('./config/aws.json');
var s3 = new AWS.S3();

var uploadToS3 = function(params, cb) {
    params.key = params.key || uuid.v4();
    s3.putObject({
        ACL: 'public-read',
        Body: params.data,
        Bucket: bucket,
        Key: params.key,
        CacheControl: 'max-age=31536000', // 1 year
        ContentType: params.contentType
    }, function(err, res) {
        if (err) {
            cb(err, res);
        } else {
            cb(null, {
                'key': params.key,
                'url': '/img/' + params.key
            });
        }
    });
};

exports.upload = function(req, res) {
    console.log('content-type: ' + req.get('content-type') + "\n");
    console.log('content-length: ' + req.get('content-length') + "\n");
    console.log('Streaming data to S3...\n');

    req.length = parseInt(req.get('content-length'), 10);
    var uploadParams = {
        data: req,
        contentType: req.get('content-type')
    };
    uploadToS3(uploadParams, function(err, uploadRes) {
        if (err) {
            res.writeHead(500, {'content-type': 'text/plain'});
            res.write("Failure. Here's the error:\n");
            res.write(util.inspect(err) + "\n");
        } else {
            res.writeHead(200, {
                'content-type': 'text/plain',
                'Location': uploadRes.url
            });
            res.write("Looks like it worked! Here's the response:\n");
            res.write(JSON.stringify(uploadRes) + "\n");
        }
        res.end();
    });
};

exports.get = function (req, res) {
    var key = req.params['key'];

    var asdf = function (err, data) {
        if (err) {
            res.writeHead(404, {'content-type': 'text/plain'});
            res.write(util.inspect(err));
            res.write(util.inspect(data));
            res.end();
        } else {
            res.writeHead(200, {
                'content-type': data.ContentType,
                'content-length': data.ContentLength
            });
            res.end(data.Body);
        }
    };

    var params = {
        Bucket: bucket,
        Key: key
    };

    s3.getObject(params)
        .on('httpData', function (chunk) {
            res.write(chunk);
        })
        .on('httpDone', function () {
            res.end();
        })
        .send();
};


var proxyImageRequest = function(req, res, key) {
    var proxyReq = http.request({
        host: 's3.amazonaws.com',
        method: req.method,
        path: '/com-athlete-ezimg/' + key,
        headers: req.headers
    });

    proxyReq.on('response', function(proxyRes) {
        proxyRes.on('data', function(chunk) {
            res.write(chunk, 'binary');
        });
        proxyRes.on('end', function() {
            res.end();
        });
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
    });
    req.on('data', function(chunk) {
        proxyReq.write(chunk, 'binary');
    });
    req.on('end', function() {
        proxyReq.end();
    });
};


var getImageData = function(key, cb) {
    var params = {
        Bucket: bucket,
        Key: key
    };
    s3.getObject(params, function(err, res) {
        console.log('finished getting image data from s3');
        cb(err, res);
    });
};


var doManipulation = function(key, manipulation, cb) {
    getImageData(key, function(err, res) {
        console.log('starting manipulations');
        var img = gm(res.Body);
        console.log('gm object created');
        img.resize(100, 100);
        console.log('resized image');

        img.toBuffer(function(err, buffer) {
            console.log('streaming modified image to s3');
            uploadToS3({
                data: buffer,
                key: key + '/' + manipulation,
                contentType: res.ContentType
            }, function(err, s3res) {
                console.log('finished saving manipulated image to s3');
                if (err) {
                    console.log('but there was an error uploading it');
                    console.log(err);
                    cb(err);
                } else {
                    cb(err, key + '/' + manipulation);
                }
            });
        });
    });
};


//var manipulations = {
//    small: [
//        {
//            operation: 'resize',
//            params: {
//                width: 100
//            }
//        }
//    ]
//};


exports.get = function (req, res) {
    var key = req.params['key'];
    var manipulation = req.params['manipulation'];
    if (manipulation) {
        doManipulation(key, manipulation, function(err, manipulationKey) {
            proxyImageRequest(req, res, manipulationKey);
        });
    } else {
        proxyImageRequest(req, res, key);
    }
};