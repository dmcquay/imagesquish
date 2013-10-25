var config = require('./config');
var winston = require('winston');

if (config.logFile) {
    winston.add(winston.transports.File, { filename:config.logFile });
}

winston.logItems = function(level, items) {
    this.log(level, items.join(' '));
};

module.exports = winston;