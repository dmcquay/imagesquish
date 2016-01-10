'use strict';

import parseDefinition from './parse-definition'
import dotenv from 'dotenv'

dotenv.load({
    silent: true
});
let env = process.env;

function parseBool(str, defaultVal) {
    if (str === undefined) {
        return defaultVal;
    }
    let strLower = str.toLowerCase();
    if (strLower === 'true') {
        return true;
    }
    if (strLower === 'false') {
        return false;
    }
    return !!str;
}

/**
 * Dynamically populates buckets.
 *
 * This is a separate, exported function so that we can test it, since
 * there's quite a bit of logic in here.
 */
export function buildBuckets(env) {
    let buckets = {};

    if (!env.BUCKETS) {
        return buckets;
    }

    for (let bucketName of env.BUCKETS.split(',')) {
        // TODO: snake case instead of just upper?
        let envPrefix = `BUCKET_${bucketName.toUpperCase()}`;
        let bucket = {
            originHost: env[`${envPrefix}_ORIGIN_HOST`],
            originPathPrefix: env[`${envPrefix}_ORIGIN_PATH_PREFIX`],
            s3CacheBucket: env[`${envPrefix}_S3_CACHE_BUCKET`],
            allowAdHoc: parseBool(env[`${envPrefix}_ALLOW_AD_HOC`], false),
            definitions: {},
            inheritFrom: env[`${envPrefix}_INHERIT_FROM`]
        };

        // unset anything that is undefined so that it can be overridden by inheritFrom
        let undefinedKeys = Object.keys(bucket).filter(key => bucket[key] === undefined);
        for (let key of undefinedKeys) {
            delete bucket[key];
        }

        let defEnvKeyPrefix = `${envPrefix}_DEF_`;
        let defEnvKeys = Object.keys(env).filter(key => key.startsWith(defEnvKeyPrefix));

        for (let defEnvKey of defEnvKeys) {
            // TODO: camelCase instead of toLowerCase?
            let defName = defEnvKey.substr(defEnvKeyPrefix.length).toLowerCase();
            bucket.definitions[defName] = parseDefinition(env[defEnvKey]);
        }

        buckets[bucketName] = bucket;
    }

    // populate inherited buckets
    for (let bucketName in buckets) {
        if (buckets.hasOwnProperty(bucketName)) {
            let bucket = buckets[bucketName];
            let inherit;
            if (bucket.inheritFrom) {
                inherit = buckets[bucket.inheritFrom];
                if (!inherit) {
                    throw Error('Bucket ' + bucketName + ' tried to inherit from '
                        + bucket.inheritFrom + ' which does not exist.');
                }
                buckets[bucketName].definitions = Object.assign(
                    {}, inherit.definitions, bucket.definitions);
                buckets[bucketName] = Object.assign({}, inherit, bucket);
            }
        }
    }

    return buckets;
}

export default {
    aws: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    },
    buckets: buildBuckets(env),
    port: env.PORT,
    maxConcurrentProxyStreams: env.MAX_CONCURRENT_PROXY_STREAMS,
    maxConcurrentManipulations: env.MAX_CONCURRENT_MANIPULATIONS,
    logLevel: env.LOG_LEVEL,
    newRelic: {
        enabled: parseBool(env.NEWRELIC_ENABLED, false),
        licenseKey: env.NEWRELIC_LICENSE_KEY,
        logLevel:env. NEWRELIC_LOG_LEVEL,
        appName: env.NEWRELIC_APP_NAME
    }
};
