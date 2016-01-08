var assert = require('assert');
var http = require('http');
var sinon = require('sinon');

var concurrency = require('./concurrency');
var proxy = require('./proxy');

describe('proxy.proxyRequest', function() {
    it('should exit the semaphore when request creation fails', function() {
        var httpMock = sinon.mock(http);
        var req = {
            headers: {}
        };
        var res = function() {};
        var host = 'localhost';
        var path = '/test/path';

        assert.equal(0, concurrency.proxyStreamsSemaphore.current);
        httpMock.expects('request').once().throws();

        assert.throws(function () {
            proxy.proxyRequest(req, res, host, path, function() {});
        });

        httpMock.verify();
        assert.equal(0, concurrency.proxyStreamsSemaphore.current);
    });
});