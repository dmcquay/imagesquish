var winston = require('winston');

let logLevel = process.env['LOG_LEVEL'] || 'info';

// suppress logging during tests
if (process.argv[1].endsWith('mocha')) {
    logLevel = 'none';
}

var logger = new (winston.Logger)({
    exitOnError: false,
    transports: [
        new winston.transports.Console({
            handleExceptions: false,
            json: false,
            level: logLevel
        })
    ]
});

logger.logItems = function(level, items) {
    this.log(level, items.join(' '));
};

module.exports = logger;