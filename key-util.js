exports.generateKey = function(bucket, imgId, manipulation) {
    manipulation = manipulation || 'original';
    return bucket + '/' + imgId + '/' + manipulation;
};