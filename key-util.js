exports.generateKey = function(bucket, imgId, manipulation) {
    if (manipulation) {
        return bucket + '/manipulations/' + imgId + '/' + manipulation;
    } else {
        return bucket + '/originals/' + imgId;
    }
};