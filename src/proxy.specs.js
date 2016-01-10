"use strict";

import assert from 'assert'
import http from 'http'

var concurrency = require('./concurrency');
var proxy = require('./proxy');

describe('proxy.proxyRequest', async () => {
    context('when request creation fails', () => {
        before(() => {
            sinon.stub(http, 'request').throws();
            var req = {
                headers: {}
            };
            var res = function() {};
            var host = 'localhost';
            var path = '/test/path';

            assert.equal(0, concurrency.proxyStreamsSemaphore.getCurrent());

            return expect(proxy.proxyRequest(req, res, host, path)).to.eventually.be.rejected;
        });

        after(() => {
            http.request.restore();
        });

        it('should exit the semaphore when request creation fails', () => {
            assert.equal(0, concurrency.proxyStreamsSemaphore.getCurrent());
        });
    });
});