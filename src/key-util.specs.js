var assert = require('assert');

import config from './config';
var keyUtil = require('./key-util');

describe('generateKey', function() {
    it('generates correct key for original', function() {
        config.buckets = {
            mybucket: {
                originalKeyFormat: '{bucket}/originals/{imgId}'
            }
        };
        var key = keyUtil.generateKey('mybucket', 'test.jpg');
        assert.equal(key, 'mybucket/originals/test.jpg');

    });

    it('generates correct key for manipulation', function() {
        config.buckets = {
            mybucket: {
                manipulationKeyFormat: 'imagesquish/{bucket}/{manipulation}/{imgId}'
            }
        };
        var key = keyUtil.generateKey('mybucket', 'test.jpg', 'small');
        assert.equal(key, 'imagesquish/mybucket/small/test.jpg');
    });
});