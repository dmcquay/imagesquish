var assert = require('assert');
var sinon = require('sinon');

import config from './config';
var health = require('./health');
var status = require('./status');

describe('health.check', function() {
    it('should pass under normal conditions', function(done) {
        health.check(function(isHealthy, failReason) {
            assert.equal(isHealthy, true);
            done();
        });
    });

    context('too many manipulations', () => {
        let statusMock, isHealthy, failReason;

        before((done) => {
            statusMock = sinon.mock(status);
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

            health.check((_isHealthy, _failReason) => {
                isHealthy = _isHealthy;
                failReason = _failReason;
                done();
            });
        });

        after(() => {
            statusMock.restore();
        });

        it('should fail', () => {
            statusMock.verify();
            assert.equal(isHealthy, false);
            assert.equal(failReason, 'Overloaded. Too many concurrent manipulations.');
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
