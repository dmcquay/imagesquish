var formidable = require('formidable');
var util = require('util');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var httpProxy = require('http-proxy');
var http = require('http');

var bucket = 'com-athlete-ezimg';

AWS.config.loadFromPath('./config/aws.json');
var s3 = new AWS.S3();

var uploadToS3 = function(body, contentType, cb) {
    var imgKey = uuid.v4();
    s3.putObject({
        ACL: 'public-read',
        Body: body,
        Bucket: bucket,
        Key: imgKey,
        CacheControl: 'max-age=31536000', // 1 year
        ContentType: contentType
    }, function(err, res) {
        if (err) {
            cb(err, res);
        } else {
            cb(null, {
                'key': imgKey,
                'url': '/img/' + imgKey
            });
        }
    });
};

exports.uploadMultipart = function(req, res){
    var form = formidable.IncomingForm();

    form.parse(req, function(err, fields, files) {
        res.writeHead(200, {'content-type': 'text-plain'});
        res.write('received upload:\n\n');
        res.end(util.inspect({fields: fields, files: files}));
    });
};

exports.uploadForm = function(req, res) {
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(
        '<form action="/upload/multipart" enctype="multipart/form-data" method="post">'+
            '<input type="file" name="upload" multiple="multiple"><br>'+
            '<input type="submit" value="Upload">'+
            '</form>'
    );
};

exports.uploadRaw = function(req, res) {
    console.log('content-type: ' + req.get('content-type') + "\n");
    console.log('content-length: ' + req.get('content-length') + "\n");
    console.log('Streaming data to S3...\n');

    req.length = parseInt(req.get('content-length'), 10);
    uploadToS3(req, req.get('content-type'), function(err, uploadRes) {
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

//exports.get = function (req, res) {
//    var key = req.params['key'];
//
//    var asdf = function (err, data) {
//        if (err) {
//            res.writeHead(404, {'content-type': 'text/plain'});
//            res.write(util.inspect(err));
//            res.write(util.inspect(data));
//            res.end();
//        } else {
//            res.writeHead(200, {
//                'content-type': data.ContentType,
//                'content-length': data.ContentLength
//            });
//            res.end(data.Body);
//        }
//    };
//
//    var params = {
//        Bucket: bucket,
//        Key: key
//    };
//
//    s3.getObject(params)
//        .on('httpData', function (chunk) {
//            res.write(chunk);
//        })
//        .on('httpDone', function () {
//            res.end();
//        })
//        .send();
//};


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


exports.get = function (req, res) {
    var key = req.params['key'];
    proxyImageRequest(req, res, key);
};