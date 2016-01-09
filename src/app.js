if (process.env['NEW_RELIC_ENABLED']) {
    require('newrelic');
}

import config from './config';

var express = require('express');
var routes = require('./routes');
var http = require('http');
var check = require('./check');
var log = require('./log');

check.initCheck();

var app = express();

// global settings
app.set('port', process.env['IMAGESQUISH_PORT'] || 3000);

// CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

// track open requests so that when we close the server we can wait for all requests to finish
var openRequestsCount = 0;
var trackOpenRequests = function(req, res, next) {
    openRequestsCount++;
    res.on('finish', function() {
        openRequestsCount--;
    });
    next();
};

// middleware
app.use(allowCrossDomain);
app.use(trackOpenRequests);

// routes
app.get('/status', routes.status);
app.get('/health-check', routes.healthCheck);
app.get(/^\/([^\/]+)\/([^\/]+)\/(.+)/, routes.get);

// global catch-all error handling
app.use(function(err, req, res, next) {
    log.error('Error on ' + req.method + ' ' + req.url);
    log.error(err.stack);
    res.status(500);
    res.send('There was an error processing this request.');
});

var server = http.createServer(app);
log.info('Waiting for config to load...');
config.once('load', function() {
    server.listen(app.get('port'), function(){
        log.info('Express server listening on port ' + app.get('port'));
    });
});

// Maintain a hash of all connected sockets so we can close them on exit
var sockets = {}, nextSocketId = 0;
server.on('connection', function (socket) {
    var socketId = nextSocketId++;
    sockets[socketId] = socket;
    socket.once('close', function () {
        delete sockets[socketId];
    });
});

// Exit cleanly. Otherwise when these signals are sent, it will exit with code 130.
// When running as a docker container in CoreOS, systemd will think that it failed.
// We want to let it know that the exit was clean.
function clean_exit() {
    server.close(function() {
        process.exit(0);
    });

    // wait for all requests to finish. then destroy all open sockets so the server will close.
    (function finish() {
        if (openRequestsCount > 0) {
            setTimeout(finish, 100);
        } else {
            // destroy all open sockets
            for (var socketId in sockets) {
                sockets[socketId].destroy();
            }
        }
    })();
}

process.on('SIGINT', clean_exit);
process.on('SIGTERM', clean_exit);
process.on('SIGHUP', clean_exit);