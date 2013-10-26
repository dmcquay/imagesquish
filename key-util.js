var config = require('./config');

var DEFAULT_MANIPULATION_KEY_FORMAT = '{bucket}/manipulations/{imgId}/{manipulation}';
var DEFAULT_ORIGINAL_KEY_FORMAT = '{bucekt}/originals/{imgId}';

exports.generateKey = function(bucket, imgId, manipulation) {
    var key;
    if (manipulation) {
        key = config.buckets[bucket].manipulationKeyFormat
            || DEFAULT_MANIPULATION_KEY_FORMAT;
    } else {
        key = config.buckets[bucket].originalKeyFormat
            || DEFAULT_ORIGINAL_KEY_FORMAT;
    }
    key = key.replace('{bucket}', bucket);
    key = key.replace('{imgId}', imgId);
    if (manipulation) {
        key = key.replace('{manipulation}', manipulation);
    }
    return key;
};

exports.generateUrl = function(req, bucket, imgId, manipulation, pathOnly) {
    var url;
    if (imgId.indexOf('/') !== -1) {
        url = '/unmanaged/' + bucket + '/' + (manipulation || 'original') + '/' + imgId;
    } else {
        url = '/' + bucket + '/' + imgId;
        if (manipulation) {
            url += '/' + manipulation;
        }
    }
    if (!pathOnly && req.headers.host) {
        url = 'http://' + req.headers.host + url;
    }
    return url;
};