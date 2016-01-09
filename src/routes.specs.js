var assert = require('assert');
var sinon = require('sinon');

import config from './config';
var proxy = require('./proxy');
var routes = require('./routes');
var storage = require('./storage');

describe('get function', function() {
    it('returns 400 if the bucket does not exist', function() {
        config.buckets = {};
        var req = {
            params: [
                'fakebucket',
                'fakemanipulation',
                'fakeimgid'
            ]
        };
        var res = {
            writeHead: sinon.spy(),
            end: sinon.spy()
        };
        routes.get(req, res);
        assert(res.writeHead.calledWith(400));
        assert(res.end.calledWith('Bucket "fakebucket" does not exist.\n'));
    });

    it('returns 403 if manipulations is OTF but OTF is not allowed by this bucket', function() {
        config.set('buckets', {
            testbucket: {
                allowOTFManipulations: false
            }
        });
        var req = {
            params: [
                'testbucket',
                'otf:resize(100)',
                'fakeimgid'
            ]
        };
        var res = {
            writeHead: sinon.spy(),
            end: sinon.spy()
        };
        routes.get(req, res);
        assert(res.writeHead.calledWith(403));
        assert(res.end.calledWith('Bucket "testbucket" does not allow on-the-fly manipulations.\n'));
    });

    it('returns 404 if the manipulation does not exist in this bucket', function() {
        config.set('buckets', {
            testbucket: {
                manipulations: {}
            }
        });
        var req = {
            params: [
                'testbucket',
                'invalidmanipulation',
                'fakeimgid'
            ]
        };
        var res = {
            writeHead: sinon.spy(),
            end: sinon.spy()
        };
        routes.get(req, res);
        assert(res.writeHead.calledWith(404));
        assert(res.end.calledWith('Manipulation "invalidmanipulation" does not exist for bucket "testbucket".\n'));
    });

    it('calls proxyRequest with correct host & path when original is requested', function() {
        config.set('buckets', {
            testbucket: {
                originHost: 'www.fakehost.com',
                originPathPrefix: 'prefix/'
            }
        });
        var req = {
            params: [
                'testbucket',
                'original',
                'mypic.jpg'
            ]
        };
        var res = {};
        var proxyMock = sinon.mock(proxy);
        proxyMock.expects('proxyRequest').withArgs(req, res, 'www.fakehost.com', '/prefix/mypic.jpg');
        routes.get(req, res);
        proxyMock.verify();
        proxyMock.restore();
    });
});