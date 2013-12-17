var log = require('./log');

var config;

try {
    var konphyg = require('konphyg')(__dirname + '/config');
    var config = konphyg('config');
} catch(err) {
    log.log('warn', 'Main config file is missing');
    config = {};
}

var bucketName;

for (bucketName in config.buckets) {
    var bucket = config.buckets[bucketName];
    var key, inherit;
    if (bucket.inheritFrom) {
        inherit = config.buckets[bucket.inheritFrom];
        if (!inherit) {
            throw Error('Bucket ' + bucketName + ' tried to inherit from '
                + bucket.inheritFrom + ' which does not exist.');
        }
        for (key in inherit) {
            bucket[key] = bucket[key] || inherit[key];
        }
    }
}

module.exports = config;