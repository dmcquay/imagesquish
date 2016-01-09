'use strict';

var deepEqual = require('deep-equal');
var Etcd = require('node-etcd');
var events = require('events');
var util = require('util');
var _ = require('underscore');

var log = require('./log');

const SOURCE_ETCD = 'etcd';
const SOURCE_ENV = 'env';
const SOURCE_S3 = 's3';

const etcdHost = process.env['ETCD_HOST'] || '127.0.0.1';
const etcdPort = process.env['ETCD_PORT'] || '4001';
const etcdRoot = process.env['ETCD_ROOT'] || 'imagesquish';

export class Config extends events.EventEmitter {
    constructor(source) {
        super();
        this.source = source;
        this.config = null;
        this.initialized = false;
        this.once('load', () => {
            this.initialized = true;
        });
        this.on('load', () => {
            log.info('Loaded config from ' + source);
        });
        this._load();
        this._loadIntervalId = setInterval(() => {
            this._load();
        }, 5000);
    }

    disableReload() {
        clearInterval(this._loadIntervalId);
    }

    get(key) {
        if (!this.initialized) {
            log.error('Tried to fetch config value before config finished loading or config failed to load.');
        }
        return this.config[key];
    }

    /**
     * Set a config value.
     * WARNING: This is for unit tests ONLY. Do not actually use.
     * TODO: Enforce use by unit tests only.
     *
     * @param key
     * @param value
     */
    set(key, value) {
        if (!this.initialized) {
            log.error('Tried to fetch config value before config finished loading or config failed to load.');
        }
        this.config[key] = value;
    }

    async _load() {
        let config;

        try {
            if (this.source === SOURCE_ETCD) {
                config = await this._loadFromEtcd();
            } else if (this.source === SOURCE_ENV) {
                config = await this._loadFromEnv();
            } else if (this.source === SOURCE_S3) {
                config = await this._loadFromS3();
            } else {
                config = await this._loadFromLocalFile();
            }

            Config._populateInheritedBuckets(config.buckets);
            if (!deepEqual(config, this.config)) {
                log.info("config changed. \nold: ", JSON.stringify(this.config), "\n new: ", JSON.stringify(config));
                this.config = config;
                this.emit('load');
            } else {
                log.debug('Loaded new config, but it was identical');
            }
        } catch(err) {
            log.error('Failed to read config from ' + this.source + '. Error: ' + util.inspect(err));
            if (this.initialized) {
                // if we have already started up, then we want to keep running w/ the old config
                log.error('Continuing with old config.');
            } else {
                // can't start w/out a config
                log.error('Cannot startup without a config.');
                throw(err);
            }
        }
    }

    async _loadFromEtcd(cb) {
        return new Promise((resolve, reject) => {
            var etcd = new Etcd(etcdHost, etcdPort);
            etcd.get(etcdRoot, {recursive: true}, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(JSON.parse(result.node.value));
                }
            });
        });
    }

    async _loadFromEnv() {
        return new Promise(function(resolve, reject) {
            resolve(JSON.parse(process.env['IMAGESQUISH_BUCKETS']));
        });
    }

    async _loadFromS3() {
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
                        reject(err)
                    }
                }
            });
        });
    }

    async _loadFromLocalFile() {
        var minimalEmptyConfig = {buckets: {}};
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                var konphyg = require('konphyg')(__dirname + '/config');
                resolve(konphyg('config'));
            } catch (err) {
                console.error('second: ', this);
                if (!self._warnedAboutMissingConfig) {
                    self._warnedAboutMissingConfig = true;
                    log.error("Failed to load config from local file. Falling back to defaults.");
                }
                resolve(minimalEmptyConfig)
            }
        });
    }

    static _populateInheritedBuckets(buckets) {
        let bucketName;
        for (bucketName in buckets) {
            if (buckets.hasOwnProperty(bucketName)) {
                let bucket = buckets[bucketName];
                if (bucket.inheritFrom) {
                    let inherit = buckets[bucket.inheritFrom];
                    if (!inherit) {
                        throw Error('Bucket ' + bucketName + ' tried to inherit from '
                            + bucket.inheritFrom + ' which does not exist.');
                    }
                    buckets[bucketName] = Object.assign({}, inherit, bucket);
                }
            }
        }
    }
}

export default new Config(process.env['CONFIG_SOURCE']);
