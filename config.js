var log = require('./log'),
    Etcd = require('node-etcd');


var config,
    loaded = false,
    waiting = [],
    SOURCE_ETCD = 'etcd',
    SOURCE_ENV = 'env',
    configSource = process.env['CONFIG_SOURCE'],
    etcdHost = process.env['ETCD_HOST'] || '127.0.0.1',
    etcdPort = process.env['ETCD_PORT'] || '4001',
    etcdRoot = process.env['ETCD_ROOT'] || 'imagesquish';


if (configSource == SOURCE_ETCD) {
    var etcd = new Etcd(etcdHost, etcdPort);
    etcd.get(etcdRoot, {recursive: true}, function (err, result) {
        if (err) {
            log.error('Failed to retrieve configuration parameters from etcd');
            process.exit();
        } else {
            config = JSON.parse(result.node.value);
            populateInheritedBuckets(config.buckets);
            loaded = true;
            log.info('Loaded configuration parameters from etcd.');
            waiting.forEach(function(cb) {
                cb();
            });
        }
    });
} else if (configSource == SOURCE_ENV) {
    config = JSON.parse(process.env['IMAGESQUISH_BUCKETS']);
    log.info('Loaded configuration parameters from environment.');
} else {
    try {
        var konphyg = require('konphyg')(__dirname + '/config');
        config = konphyg('config');
        populateInheritedBuckets(config.buckets);
        loaded = true;
        log.info('Loaded configuration parameters from file.');
    } catch (err) {
        log.error("Failed to load configuration from file.");
        process.exit();
    }
}


function populateInheritedBuckets(buckets) {
    var bucketName;
    for (bucketName in buckets) {
        if (buckets.hasOwnProperty(bucketName)) {
            var bucket = buckets[bucketName];
            var key, inherit;
            if (bucket.inheritFrom) {
                inherit = buckets[bucket.inheritFrom];
                if (!inherit) {
                    throw Error('Bucket ' + bucketName + ' tried to inherit from '
                    + bucket.inheritFrom + ' which does not exist.');
                }
                for (key in inherit) {
                    if (inherit.hasOwnProperty(key)) {
                        bucket[key] = bucket[key] || inherit[key];
                    }
                }
            }
        }
    }
}

exports.get = function(key) {
    if (!loaded) {
        log.error('Tried to fetch config value before config finished loading or config failed to load.');
    }
    return config[key];
};

exports.waitUntilLoaded = function(cb) {
    if (loaded) {
        cb();
    } else {
        waiting.push(cb);
    }
};