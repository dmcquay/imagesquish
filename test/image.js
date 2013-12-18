var activeManipulations = require('../manipulations-status').activeManipulations;
var assert = require('assert');
var concurrency = require('../concurrency');
var config = require('../config');
var http = require('http');
var image = require('../image');
var sinon = require('sinon');
var storage = require('../storage');


describe('image.doManipulation', function() {
    beforeEach(function() {
        config.buckets = {
            mybucket: {
                manipulations: {
                    small: [{
                        operation: "resize",
                        params: [100, 100]
                    }]
                }
            }
        };
    });

    it('should make an http request with correct host & path in uncached case', function(done) {
        var httpMock = sinon.mock(http);
        var fakeReq = {
            on: function(evt, cb) {
                cb({
                    statusCode: 200,
                    headers: {
                        'content-type': 'image/jpeg'
                    }
                });
            },
            end: function() {}
        };
        httpMock.expects('request').once().returns(fakeReq);
        var manipulateImageStub = sinon.stub(image, 'manipulate').returns(null);
        var uploadImageStub = sinon.stub(image, 'uploadImage').callsArg(4);
        image.doManipulation('mybucket', 'test.jpg', 'small', function(err) {
            assert.strictEqual(typeof(err), 'undefined');
            httpMock.verify();
            httpMock.restore();
            manipulateImageStub.restore();
            uploadImageStub.restore();
            done();
        });
    });

    it('should leave semaphore and remove from activeManipulations if s3 response is not 200', function(done) {
        // make sure we have a clean slate to start
        assert.deepEqual(activeManipulations.manipulations, []);
        var fakeReq = {
            on: function(evt, cb) {
                cb({statusCode: 404});
            },
            end: function() {}
        };
        var httpStub = sinon.stub(http, 'request').returns(fakeReq);
        image.doManipulation('mybucket', 'test2.jpg', 'small', function(err) {
            assert.equal(err.name, 'ImageDoesNotExistAtOrigin');
            assert.equal(concurrency.manipulationsSemaphore.current, 0);
            assert.deepEqual(activeManipulations.manipulations, []);
            httpStub.restore();
            done();
        });
    });

    it('should leave semaphore and remove from activeManipulations if processing or upload has error', function(done) {
        // make sure we have a clean slate to start
        assert.deepEqual(activeManipulations.manipulations, []);
        var fakeReq = {
            on: function(evt, cb) {
                cb({
                    statusCode: 200,
                    headers: {
                        'content-type': 'image/jpeg'
                    }
                });
            },
            end: function() {}
        };
        var httpStub = sinon.stub(http, 'request').returns(fakeReq);
        var imageMock = sinon.mock(image);
        imageMock.expects('uploadImage').once().callsArgWith(4, {name:'SomeError'});
        image.doManipulation('mybucket', 'test.jpg', 'small', function(err) {
            assert.equal(err.name, 'SomeError');
            assert.equal(concurrency.manipulationsSemaphore.current, 0);
            assert.deepEqual(activeManipulations.manipulations, []);
            imageMock.verify();
            imageMock.restore();
            httpStub.restore();
            done();
        });
    });

    it('should leave semaphore and remove from activeManipulations if manipulation does not exist', function(done) {
        // make sure we have a clean slate to start
        assert.deepEqual(activeManipulations.manipulations, []);
        var fakeReq = {
            on: function(evt, cb) {
                cb({
                    statusCode: 200,
                    headers: {
                        'content-type': 'image/jpeg'
                    }
                });
            },
            end: function() {}
        };
        var httpStub = sinon.stub(http, 'request').returns(fakeReq);
        var imageMock = sinon.mock(image);
        imageMock.expects('manipulate').once().throws(Error('NoSuchOperation'));
        imageMock.expects('uploadImage').atMost(0);
        image.doManipulation('mybucket', 'test.jpg', 'small', function(err) {
            assert.equal(err.name, 'NoSuchOperation');
            assert.equal(concurrency.manipulationsSemaphore.current, 0);
            assert.deepEqual(activeManipulations.manipulations, []);
            imageMock.verify();
            imageMock.restore();
            httpStub.restore();
            done();
        });
    });
});

describe('image.uploadImage', function() {
    it('calls storage.upload with correct params and passes error', function(done) {
        var img = {
            toBuffer: function(cb) {
                cb(undefined, 'fakebuffer');
            }
        };
        var storageMock = sinon.mock(storage);
        storageMock.expects('upload').withArgs({
            bucket: 'fakebucket',
            data: 'fakebuffer',
            contentType: 'image/jpeg',
            key: 'fakekey'
        }).callsArgWith(1, 'ExampleError');
        image.uploadImage(img, 'fakebucket', 'fakekey', 'image/jpeg', function(err) {
            assert.equal(err, 'ExampleError');
            storageMock.verify();
            storageMock.restore();
            done();
        });
    });

    it('calls callback with err if toBuffer has error and does not call storage.upload', function(done) {
        var img = {
            toBuffer: function(cb) {
                cb('ErrorFromToBuffer');
            }
        };
        var storageMock = sinon.mock(storage);
        storageMock.expects('upload').never();
        image.uploadImage(img, 'fakebucket', 'fakekey', 'image/jpeg', function(err) {
            assert.equal(err, 'ErrorFromToBuffer');
            storageMock.verify();
            storageMock.restore();
            done();
        })
    });
});

describe('image.manipulate', function() {
    it('throws an error if the manipulation does not exist', function() {
        config.buckets = {
            mybucket: {
                manipulations: {
                    small: [{
                        operation: "fakeoperation",
                        params: [100, 100]
                    }]
                }
            }
        };
        var img = {
            toBuffer: function(cb) {
                cb();
            }
        };
        assert.throws(function() {
            image.manipulate(img, 'small', 'mybucket');
        }, 'NoSuchOperation');

    });
});

describe('parseOTFSteps', function() {
    it('works for single operation with parameters', function() {
        assert.deepEqual(image.parseOTFSteps('otf:resize(100,100)'), [
            {operation: 'resize', params: ["100", "100"]}
        ]);
    });

    it('works for single operation with parens but not parameters', function() {
        assert.deepEqual(image.parseOTFSteps('otf:autoOrient()'), [
            {operation: 'autoOrient', params: []}
        ]);
    });

    it('works for single operation without or parameters', function() {
        assert.deepEqual(image.parseOTFSteps('otf:autoOrient'), [
            {operation: 'autoOrient', params: []}
        ]);
    });

    it('works for multiple operations', function() {
        assert.deepEqual(image.parseOTFSteps('otf:autoOrient:resize(100,200)'), [
            {operation: 'autoOrient', params: []},
            {operation: 'resize', params: ["100", "200"]}
        ]);
    });
});