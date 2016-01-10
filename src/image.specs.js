"use strict";

var assert = require('assert');
var http = require('http');

import activeManipulations from './manipulations-status'
var concurrency = require('./concurrency');
import config from './config';
import * as image from './image';
var keyUtil = require('./key-util');
var storage = require('./storage');

describe('image.doManipulation', function() {
    let bucket = 'testbucket';
    let imgId = 'test.jpg';
    let manipulation = 'small';
    let s3DestKey = 'tests3key';

    //before(function() {
    //    sinon.stub(config, 'get').returns({
    //        [bucket]: {
    //            manipulations: {
    //                [manipulation]: [{
    //                    operation: "resize",
    //                    params: [100, 100]
    //                }]
    //            }
    //        }
    //    });
    //});
    //
    //after(() => {
    //    config.get.restore();
    //});

    context('happy path, uncached, not active', () => {
        //let httpMock;
        //let manipulateImageStub;
        //let uploadImageStub;

        before(async () => {


            //let fakeReq = {
            //    on: function(evt, cb) {
            //        cb({
            //            statusCode: 200,
            //            headers: {
            //                'content-type': 'image/jpeg'
            //            }
            //        });
            //    },
            //    end: function() {}
            //};

            sinon.stub(keyUtil, 'generateKey').returns(s3DestKey);
            sinon.stub(activeManipulations, 'isActive').returns(false);
            sinon.spy(activeManipulations, 'wait');
            sinon.stub(activeManipulations, 'queue');
            sinon.spy(activeManipulations, 'start');
            sinon.stub(concurrency.manipulationsSemaphore, 'take').returns(Promise.resolve());
            //console.log(activeManipulations.isActive());
            //console.log(activeManipulations.isActive.calledOnce);

            //activeManipulationsMock = sinon.mock(activeManipulations);
            //activeManipulationsMock.expects('isActive').once().returns(false);

            //httpMock = sinon.stub(http, 'request').expects('request').once().returns(fakeReq);
            //manipulateImageStub = sinon.stub(image, 'manipulate').returns(null);
            //uploadImageStub = sinon.stub(image, 'uploadImage').callsArg(4);

            await image.doManipulation(bucket, imgId, manipulation);
        });

        after(() => {
            keyUtil.generateKey.restore();
            activeManipulations.isActive.restore();
            activeManipulations.wait.restore();
            activeManipulations.queue.restore();
            activeManipulations.start.restore();
            concurrency.manipulationsSemaphore.take.restore();
            //httpMock.restore();
            //manipulateImageStub.restore();
            //uploadImageStub.restore();
        });

        it('fetches the key using the key util', () => {
            expect(keyUtil.generateKey.calledOnce).to.be.true;
            expect(keyUtil.generateKey.calledWithExactly(bucket, imgId, manipulation)).to.be.true;
        });

        it('checks if this manipulation is already in progress', () => {
            expect(activeManipulations.isActive.calledOnce).to.be.true;
            expect(activeManipulations.isActive.calledWithExactly(s3DestKey));
        });

        it('does not wait for the active manipulation since it is not active', () => {
            expect(activeManipulations.wait.called).to.be.false;
        });

        it('queues the manipulation', () => {
            expect(activeManipulations.queue.calledOnce).to.be.true;
        });

        it('waits for the semaphore', () => {
            // Note: I'm only checking if it was called, but I wish I could check if we awaited it. Ideas?
            expect(concurrency.manipulationsSemaphore.take.calledOnce).to.be.true;
        });

        it('registers that we started this manipulation', () => {
            expect(activeManipulations.start.calledWith(s3DestKey)).to.be.true;
        });
    });

    //it('should make an http request with correct host & path in uncached case', function(done) {
    //
    //});
    //
    //it('should leave semaphore and remove from activeManipulations if s3 response is not 200', function(done) {
    //    // make sure we have a clean slate to start
    //    assert.deepEqual(activeManipulations.manipulations, []);
    //    var fakeReq = {
    //        on: function(evt, cb) {
    //            cb({statusCode: 404});
    //        },
    //        end: function() {}
    //    };
    //    var httpStub = sinon.stub(http, 'request').returns(fakeReq);
    //    image.doManipulation('mybucket', 'test2.jpg', 'small', function(err) {
    //        assert.equal(err.name, 'ImageDoesNotExistAtOrigin');
    //        assert.equal(concurrency.manipulationsSemaphore.current, 0);
    //        assert.deepEqual(activeManipulations.manipulations, []);
    //        httpStub.restore();
    //        done();
    //    });
    //});
    //
    //it('should leave semaphore and remove from activeManipulations if processing or upload has error', function(done) {
    //    // make sure we have a clean slate to start
    //    assert.deepEqual(activeManipulations.manipulations, []);
    //    var fakeReq = {
    //        on: function(evt, cb) {
    //            cb({
    //                statusCode: 200,
    //                headers: {
    //                    'content-type': 'image/jpeg'
    //                }
    //            });
    //        },
    //        end: function() {}
    //    };
    //    var httpStub = sinon.stub(http, 'request').returns(fakeReq);
    //    var imageMock = sinon.mock(image);
    //    imageMock.expects('oldUploadImage').once().callsArgWith(4, {name:'SomeError'});
    //    image.doManipulation('mybucket', 'test.jpg', 'small', function(err) {
    //        assert.equal(err.name, 'SomeError');
    //        assert.equal(concurrency.manipulationsSemaphore.current, 0);
    //        assert.deepEqual(activeManipulations.manipulations, []);
    //        imageMock.verify();
    //        imageMock.restore();
    //        httpStub.restore();
    //        done();
    //    });
    //});
    //
    //it('should leave semaphore and remove from activeManipulations if manipulation does not exist', function(done) {
    //    // make sure we have a clean slate to start
    //    assert.deepEqual(activeManipulations.manipulations, []);
    //    var fakeReq = {
    //        on: function(evt, cb) {
    //            cb({
    //                statusCode: 200,
    //                headers: {
    //                    'content-type': 'image/jpeg'
    //                }
    //            });
    //        },
    //        end: function() {}
    //    };
    //    var httpStub = sinon.stub(http, 'request').returns(fakeReq);
    //    var imageMock = sinon.mock(image);
    //    imageMock.expects('manipulate').once().throws(Error('NoSuchOperation'));
    //    imageMock.expects('oldUploadImage').atMost(0);
    //    image.doManipulation('mybucket', 'test.jpg', 'small', function(err) {
    //        assert.equal(err.name, 'NoSuchOperation');
    //        assert.equal(concurrency.manipulationsSemaphore.current, 0);
    //        assert.deepEqual(activeManipulations.manipulations, []);
    //        imageMock.verify();
    //        imageMock.restore();
    //        httpStub.restore();
    //        done();
    //    });
    //});
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
