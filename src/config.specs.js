"use strict";

var assert = require('assert');

import config from './config';

before(() => {
    // in case tests are run long enough to reload, we don't want to
    config.disableReload();
});

describe('config', function() {
    it('buckets can inherit', function() {
        var buckets = {
            "main": {
                "originHost": "example.com",
                "manipulationsS3Bucket": "com-example-manipulations",
                "allowOTFManipulations": true,
                "manipulations": {
                    "brand": [
                        { "operation": "quality", "params": [90] }
                    ],
                    "landing_banner": [
                        { "operation": "resize", "params": [800, null] },
                        { "operation": "crop", "params": [800, 320] },
                        { "operation": "quality", "params": [90] }
                    ]
                }
            },
            "dev": {
                "inheritFrom": "main",
                "manipulationsS3Bucket": "com-example-manipulations-dev",
                "allowOTFManipulations": false
            }
        };
        config._populateInheritedBuckets(buckets);
        assert.equal(buckets.dev.allowOTFManipulations, false);
        assert.equal(buckets.dev.originHost, 'example.com');
        assert.deepEqual(buckets.dev.manipulations.brand, buckets.main.manipulations.brand);
        assert.equal(buckets.dev.manipulations.brand[0].operation, 'quality');
    });
});
