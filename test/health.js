var assert = require('assert');
var config = require('../config');
var health = require('../health');
var sinon = require('sinon');
var status = require('../status');

describe('health.check', function() {
    it('should pass under normal conditions', function(done) {
        health.check(function(isHealthy, failReason) {
            assert.equal(isHealthy, true);
            done();
        });
    });

    it('should fail when too many manipulations', function(done) {
        var statusMock = sinon.mock(status);
        statusMock.expects('getStatusInfo').once().returns({
            manipulations: {
                currentCount: 1,
                limit: 1,
                currentQueueSize: 4
            },
            proxyStreams: {
                currentCount: 0,
                limit: 10,
                currentQueueSize: 0
            }
        });
        health.check(function(isHealthy, failReason) {
            statusMock.restore();
            statusMock.verify();
            assert.equal(isHealthy, false);
            assert.equal(failReason, 'Overloaded. Too many concurrent manipulations.');
            done();
        });
    });

    it('should fail when too many proxy streams', function(done) {
        var statusMock = sinon.mock(status);
        statusMock.expects('getStatusInfo').once().returns({
            manipulations: {
                currentCount: 0,
                limit: 10,
                currentQueueSize: 0
            },
            proxyStreams: {
                currentCount: 1,
                limit: 1,
                currentQueueSize: 6
            }
        });
        health.check(function(isHealthy, failReason) {
            statusMock.restore();
            statusMock.verify();
            assert.equal(isHealthy, false);
            assert.equal(failReason, 'Overloaded. Too many concurrent proxy streams.');
            done();
        });
    });
});