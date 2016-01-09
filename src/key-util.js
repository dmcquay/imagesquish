import config from './config';

var DEFAULT_MANIPULATION_KEY_FORMAT = 'imagesquish/{bucket}/{manipulation}/{imgId}';
var DEFAULT_ORIGINAL_KEY_FORMAT = '{bucket}/originals/{imgId}'; // used for upload only

/**
 * Generates a key (path) for where an original image or a manipulation.
 * To get a path for the original image, do NOT provide a manipulation.
 * The format of these paths is configured with the following keys in
 * each bucket config:
 *
 *  - manipulationKeyFormat
 *  - originalKeyFormat
 *
 * Sane defaults are provided so these do not need to be configured.
 *
 * Generating keys for original images is only used when uploading originals.
 * This is experimental and not well supported for now. The main use is generating
 * keys for manipulated images.
 *
 * @param bucket
 * @param imgId
 * @param manipulation
 * @returns {XML}
 */
exports.generateKey = function(bucket, imgId, manipulation) {
    var key,
        buckets = config.get('buckets');
    if (manipulation) {
        key = buckets[bucket].manipulationKeyFormat
            || DEFAULT_MANIPULATION_KEY_FORMAT;
    } else {
        key = buckets[bucket].originalKeyFormat
            || DEFAULT_ORIGINAL_KEY_FORMAT;
    }
    key = key.replace('{bucket}', bucket);
    key = key.replace('{imgId}', imgId);
    if (manipulation) {
        key = key.replace('{manipulation}', manipulation);
    }
    return key;
};

/**
 * Used to generate a URL to return after an original image is uploaded.
 * Not really used or well supported right now.
 *
 * @param req
 * @param bucket
 * @param imgId
 * @param manipulation
 * @param pathOnly
 * @returns {string}
 */
exports.generateUrl = function(req, bucket, imgId, manipulation, pathOnly) {
    var url = '/' + bucket + '/' + (manipulation || 'original') + '/' + imgId;
    if (!pathOnly && req.headers.host) {
        url = 'http://' + req.headers.host + url;
    }
    return url;
};