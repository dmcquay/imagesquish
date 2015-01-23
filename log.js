var winston = require('winston');

var logger = new (winston.Logger)({
    exitOnError: false,
    transports: [
        new winston.transports.Console({
            handleExceptions: false,
            json: false,
            level: 'info'
        })
    ]
});

logger.logItems = function(level, items) {
    this.log(level, items.join(' '));
};

module.exports = logger;