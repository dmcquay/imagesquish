var AWS = require('aws-sdk');

var s3 = new AWS.S3();

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