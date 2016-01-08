var winston = require('winston');

var logger = new (winston.Logger)({
    exitOnError: false,
    transports: [
        new winston.transports.Console({
            handleExceptions: false,
            json: false,
            level: process.env['LOG_LEVEL'] || 'info'
        })
    ]
});

logger.logItems = function(level, items) {
    this.log(level, items.join(' '));
};

module.exports = logger;