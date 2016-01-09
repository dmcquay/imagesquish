"use strict";

var assert = require('assert');
var http = require('http');
var sinon = require('sinon');

var activeManipulations = require('./manipulations-status').activeManipulations;
var concurrency = require('./concurrency');
import config from './config';
import * as image from './image';
var storage = require('./storage');

describe('image.doManipulation', function() {
    beforeEach(function() {
        config.set('buckets', {
            mybucket: {
                manipulations: {
                    small: [{
                        operation: "resize",
                        params: [100, 100]
                    }]
                }
            }
        });
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
        var uploadImageStub = sinon.stub(image, 'oldUploadImage').callsArg(4);
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
        imageMock.expects('oldUploadImage').once().callsArgWith(4, {name:'SomeError'});
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
        imageMock.expects('oldUploadImage').atMost(0);
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
    let buffer = 'fakebuffer';
    let bucket = 'testbucket';
    let key = 'testkey';
    let contentType = 'image/jpeg';

    context('happy path', () => {
        let storageMock;

        let img = {
            toBuffer: sinon.stub().callsArgWith(0, undefined, buffer)
        };

        before(async () => {
            storageMock = sinon.mock(storage, 'upload');
            storageMock.expects('upload').once().withArgs({
                bucket,
                data: buffer,
                contentType,
                key
            }).callsArg(1);
            await image.uploadImage(img, bucket, key, contentType);
        });

        after(() => {
            storageMock.restore();
        });

        it('calls toBuffer on the image', () => {
            expect(img.toBuffer.called).to.be.true;
        });

        it('calls storage.upload with the correct params', () => {
            storageMock.verify();
        });
    });

    context('when there is an error converting the image to buffer', () => {
        let thrownError = new Error("HorribleError");
        let img = {
            toBuffer: sinon.stub().callsArgWith(0, thrownError)
        };

        it('throws the error', () => {
            return expect(image.uploadImage(img, bucket, key, contentType)).to.eventually.be.rejectedWith(thrownError);
        })
    });

    context('when there is an error uploading the file to s3', () => {
        let thrownError = new Error("HorribleError");
        let img = {
            toBuffer: sinon.stub().callsArgWith(0, undefined, buffer)
        };

        before(async () => {
            sinon.stub(storage, 'upload').callsArgWith(1, thrownError);
        });

        after(() => {
            storage.upload.restore();
        });

        it('throws the error', () => {
            return expect(image.uploadImage(img, bucket, key, contentType))
                .to.eventually.be.rejectedWith(thrownError);
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
