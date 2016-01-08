var exec = require('child_process').exec;

var log = require('./log');

exports.initCheck = function() {
    exec("gm", function (error, stdout, stderr) {
        // Validate the output with one of the parameters.
        if (error && error.code == 127) {
            log.error('it appears that graphics magick is not properly installed');
        }
    });
};