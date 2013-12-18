var AWS = require('aws-sdk');
var config = require('./config');
var log = require('./log');

try {
    AWS.config.loadFromPath('./config/aws.json');
} catch(err) {
    log.log('warn', 'AWS config file is missing');
}

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