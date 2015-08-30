var log = require('./log'),
    deepEqual = require('deep-equal'),
    Etcd = require('node-etcd'),
    events = require('events'),
    Promise = require('bluebird'),
    util = require('util'),
    _ = require('underscore');

var SOURCE_ETCD = 'etcd',
    SOURCE_ENV = 'env',
    SOURCE_S3 = 's3',
    etcdHost = process.env['ETCD_HOST'] || '127.0.0.1',
    etcdPort = process.env['ETCD_PORT'] || '4001',
    etcdRoot = process.env['ETCD_ROOT'] || 'imagesquish';

var Config = function (source) {
    events.EventEmitter.call(this);
    var self = this;
    this.source = source;
    this.config = null;
    this.initialized = false;
    this.once('load', function () {
        self.initialized = true;
    });
    this.on('load', function() {
        log.info('Loaded config from ' + source);
    });
    this._load();
    setInterval(function() {
        self._load();
    }, 5000);
};

util.inherits(Config, events.EventEmitter);

Config.prototype.get = function (key) {
    if (!this.initialized) {
        log.error('Tried to fetch config value before config finished loading or config failed to load.');
    }
    return this.config[key];
};

/**
 * Set a config value.
 * WARNING: This is for unit tests ONLY. Do not actually use.
 * TODO: Enforce use by unit tests only.
 *
 * @param key
 * @param value
 */
Config.prototype.set = function (key, value) {
    if (!this.initialized) {
        log.error('Tried to fetch config value before config finished loading or config failed to load.');
    }
    this.config[key] = value;
};

Config.prototype._load = function () {
    var self = this,
        promise;

    if (this.source === SOURCE_ETCD) {
        promise = this._loadFromEtcd();
    } else if (this.source === SOURCE_ENV) {
        promise = this._loadFromEnv();
    } else if (this.source === SOURCE_S3) {
        promise = this._loadFromS3();
    } else {
        promise = this._loadFromLocalFile();
    }

    promise.then(function (config) {
        self._populateInheritedBuckets(config.buckets);
        if (!deepEqual(config, self.config)) {
            self.config = config;
            self.emit('load');
        } else {
            log.debug('Loaded new config, but it was identical');
        }
    }).catch(function (err) {
        log.error('Failed to read config from ' + self.source + '. Error: ' + util.inspect(err));
        if (self.initialized) {
            // if we have already started up, then we want to keep running w/ the old config
            log.error('Continuing with old config.');
        } else {
            // can't start w/out a config
            log.error('Cannot startup without a config.');
            throw(err);
        }
    });
};

Config.prototype._loadFromEtcd = function (cb) {
    return new Promise(function(resolve, reject) {
        var etcd = new Etcd(etcdHost, etcdPort);
        etcd.get(etcdRoot, {recursive: true}, function (err, result) {
            if (err) {
                reject(err);

            } else {
                config = JSON.parse(result.node.value);
                populateInheritedBuckets(config.buckets);
                loadedEvent.trigger();
                log.info('Loaded configuration parameters from etcd.');
            }
        });
    });
};

Config.prototype._loadFromEnv = function () {
    return new Promise(function(resolve, reject) {
        resolve(JSON.parse(process.env['IMAGESQUISH_BUCKETS']));
    });
};

Config.prototype._loadFromS3 = function () {
    return new Promise(function (resolve, reject) {
        var AWS = require('aws-sdk');
        var s3 = new AWS.S3();
        var params = {
            Bucket: process.env['S3_CONFIG_BUCKET'],
            Key: process.env['S3_CONFIG_KEY']
        };
        s3.getObject(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                try {
                    resolve(JSON.parse(data.Body));
                } catch(err) {
                    reject(err);
                }
            }
        });
    });
};

Config.prototype._loadFromLocalFile = function () {
    return new Promise(function(resolve, reject) {
        try {
            var konphyg = require('konphyg')(__dirname + '/config');
            resolve(konphyg('config'));
        } catch (err) {
            reject(err);
        }
    });
};

Config.prototype._populateInheritedBuckets = function (buckets) {
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
                buckets[bucketName] = _.extend({}, inherit, bucket);
            }
        }
    }
};

var config = new Config(process.env['CONFIG_SOURCE']);

module.exports = config;