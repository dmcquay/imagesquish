var STATUS_QUEUED = 'queued',
    STATUS_PROCESSING = 'processing';

function ActiveManipulations() {
    this.manipulations = {};
}

ActiveManipulations.prototype = {
    queue: function(key) {
        this.manipulations[key] = {
            status: STATUS_QUEUED,
            callbacks: []
        }
    },

    start: function(key) {
        if (typeof(this.manipulations[key]) === 'undefined') {
            throw Error("Must call queue before calling start for a given key");
        }
        this.manipulations[key].status = STATUS_PROCESSING;
    },

    finish: function(key, err) {
        this.manipulations[key].callbacks.forEach(function(cb) {
            cb(err);
        });
        delete this.manipulations[key];
    },

    wait: function(key, cb) {
        if (typeof(this.manipulations[key]) === 'undefined') {
            throw Error("Must call queue before calling wait for a given key");
        }
        this.manipulations[key].callbacks.push(cb);
    },

    isActive: function(key) {
        return typeof(this.manipulations[key]) !== 'undefined';
    }
};

module.exports = {
    // these are just exposed for testing
    ActiveManipulations: ActiveManipulations,

    // this is what we really use
    activeManipulations: new ActiveManipulations()
};