"use strict";

import assert from 'assert'
import {buildBuckets} from './config'

describe('config', function() {
    it('fully populated config with inheritance', function() {
        var testEnv = {
            AWS_ACCESS_KEY_ID: 'myaccesskeyid',
            AWS_SECRET_ACCESS_KEY: 'mysecret',
            LOG_LEVEL: 'info',
            PORT: '3000',
            MAX_CONCURRENT_PROXY_STREAMS: '20',
            MAX_CONCURRENT_MANIPULATIONS: '2',

            NEWRELIC_ENABLED: 'true',
            NEWRELIC_LICENSE_KEY: 'mynrlicensekey',
            NEWRELIC_LOG_LEVEL: 'info',
            NEWRELIC_APP_NAME: 'mynrapp',

            BUCKETS: 'sample,other',

            BUCKET_SAMPLE_ORIGIN_HOST: 's3.amazonaws.com',
            BUCKET_SAMPLE_ORIGIN_PATH_PREFIX: 'com-example-images/',
            BUCKET_SAMPLE_S3_CACHE_BUCKET: 'com-example-image-manipulations',
            BUCKET_SAMPLE_ALLOW_AD_HOC: 'true',
            BUCKET_SAMPLE_DEF_SMALL: 'resize(100)',
            BUCKET_SAMPLE_DEF_624x410: 'crop(624,410)',

            BUCKET_OTHER_INHERIT_FROM: 'sample',
            BUCKET_OTHER_DEF_624x410: 'crop(624,410):qualtiy(90)',
            BUCKET_OTHER_DEF_TINY: 'resize(10,10)'
        };

        let expected = {
            "sample": {
                "originHost": "s3.amazonaws.com",
                "originPathPrefix": "com-example-images/",
                "s3CacheBucket": "com-example-image-manipulations",
                "allowAdHoc": true,
                "definitions": {
                    "small": [{"operation": "resize", "params": ["100"]}],
                    "624x410": [{"operation": "crop", "params": ["624", "410"]}]
                }
            },
            "other": {
                "s3CacheBucket": "com-example-image-manipulations",
                "definitions": {
                    "small": [{"operation": "resize", "params": ["100"]}],
                    "624x410": [
                        {"operation": "crop", "params": ["624", "410"]},
                        {"operation": "qualtiy", "params": ["90"]}
                    ],
                    "tiny": [{"operation": "resize", "params": ["10", "10"]}]
                },
                "allowAdHoc": false,
                "originPathPrefix": "com-example-images/",
                "originHost": "s3.amazonaws.com",
                "inheritFrom": "sample"
            }
        };
        let actual = buildBuckets(testEnv);

        expect(actual).to.eql(expected);
    });
});
