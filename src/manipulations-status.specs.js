var assert = require('assert');
var sinon = require('sinon');

import {ActiveManipulations} from './manipulations-status'

describe('ActiveManipulations', function() {
    it('should be initialized with an empty list', function() {
        var manips = new ActiveManipulations();
        assert.deepEqual(manips.manipulations, {});
    });

    it('queue function should add with status "queued" and no callbacks', function() {
        var manips = new ActiveManipulations();
        manips.queue('test');
        assert.deepEqual(
            manips.manipulations['test'],
            {status: 'queued', callbacks: []}
        );
    });

    it('start function should set status to "processing"', function() {
        var manips = new ActiveManipulations();
        manips.queue('test');
        manips.start('test');
        assert.equal(manips.manipulations['test'].status, 'processing');
    });

    it('trying to start before queue should throw Error', function() {
        var manips = new ActiveManipulations();
        assert.throws(function() {
            manips.start('test');
        }, /Must call queue before calling start for a given key/);
    });

    it('trying to wait before queue should throw Error', async () => {
        var manips = new ActiveManipulations();
        await expect(manips.wait('test')).to.eventually.be.rejectedWith(/Must call queue before calling wait for a given key/);
    });

    it('calling finish twice should call my callback and empty the list', async () => {
        var manips = new ActiveManipulations();
        manips.queue('test');
        let promise = manips.wait('test');
        manips.finish('test');
        await promise;
        assert.deepEqual(manips.manipulations, []);
    });

    it('error passed to finish should be thrown', async () => {
        var manips = new ActiveManipulations();
        manips.queue('test');
        let promise = manips.wait('test');
        manips.finish('test', 'something failed');
        await expect(promise).to.eventually.be.rejectedWith(/something failed/);
    });

    it('isActive returns false for an inactive key', function() {
        var manips = new ActiveManipulations();
        assert.strictEqual(manips.isActive('asdf'), false);
    });

    it('isActive returns true for an active key', function() {
        var manips = new ActiveManipulations();
        manips.queue('asdf');
        assert.strictEqual(manips.isActive('asdf'), true);
    });

    it('isActive returns false for a key that was active, but finished', function() {
        var manips = new ActiveManipulations();
        manips.queue('asdf');
        manips.finish('asdf');
        assert.strictEqual(manips.isActive('asdf'), false);
    });
});