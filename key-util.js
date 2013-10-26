exports.generateKey = function(bucket, imgId, manipulation) {
    if (manipulation) {
        return bucket + '/manipulations/' + imgId + '/' + manipulation;
    } else {
        return bucket + '/originals/' + imgId;
    }
};

exports.generateUrl = function(req, bucket, imgId, manipulation, pathOnly) {
    var url = '/' + bucket + '/' + imgId;
    if (manipulation) {
        url += '/' + manipulation;
    }
    if (!pathOnly && req.headers.host) {
        url = 'http://' + req.headers.host + url;
    }
    return url;
};