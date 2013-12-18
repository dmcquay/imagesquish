var assert = require('assert');
var ActiveManipulations = require('../manipulations-status').ActiveManipulations;
var sinon = require('sinon');

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

    it('trying to wait before queue should throw Error', function() {
        var manips = new ActiveManipulations();
        assert.throws(function() {
            manips.wait('test');
        }, /Must call queue before calling wait for a given key/);
    });

    it('calling finish twice should call my callback and empty the list', function() {
        var manips = new ActiveManipulations();
        var cb = sinon.spy();
        manips.queue('test');
        manips.wait('test', cb);
        manips.finish('test');
        assert(cb.calledOnce);
        assert.deepEqual(manips.manipulations, []);
    });

    it('error passed to finish should be included in callback arguments', function() {
        var manips = new ActiveManipulations();
        var cb = sinon.spy();
        manips.queue('test');
        manips.wait('test', cb);
        manips.finish('test', 'something failed');
        assert(cb.calledWith('something failed'));
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