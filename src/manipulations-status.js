var STATUS_QUEUED = 'queued',
    STATUS_PROCESSING = 'processing';

export class ActiveManipulations {
    manipulations = {};

    constructor() {}

    queue(key) {
        this.manipulations[key] = {
            status: STATUS_QUEUED,
            callbacks: []
        }
    }

    start(key) {
        if (typeof(this.manipulations[key]) === 'undefined') {
            throw Error("Must call queue before calling start for a given key");
        }
        this.manipulations[key].status = STATUS_PROCESSING;
    }

    finish(key, err) {
        this.manipulations[key].callbacks.forEach(function(cb) {
            cb(err);
        });
        delete this.manipulations[key];
    }

    async wait(key) {
        let self = this;
        return new Promise(function(resolve, reject) {
            if (typeof(self.manipulations[key]) === 'undefined') {
                reject(new Error("Must call queue before calling wait for a given key"));
            }
            self.manipulations[key].callbacks.push((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    isActive(key) {
        return typeof(this.manipulations[key]) !== 'undefined';
    }
}

export default new ActiveManipulations()