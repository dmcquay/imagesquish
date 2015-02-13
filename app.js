var newrelicEnabled = false;
if (process.env['NEWRELIC_ENABLED']) {
    require('newrelic');
    newrelicEnabled = true;
}

var config = require('./config');
var express = require('express');
var routes = require('./routes');
var http = require('http');
var check = require('./check');
var log = require('./log');

if (newrelicEnabled) {
    log.info('New Relic is enabled');
}

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

// middleware
app.use(express.logger());
app.use(allowCrossDomain);
app.use(app.router);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routes
app.get('/status', routes.status);
app.post('/:bucket/upload', routes.upload);
app.post('/:bucket/upload/raw', routes.uploadRaw);
app.post('/:bucket/upload/multipart', routes.uploadMultipart);
app.get(/^\/um\/([^\/]+)\/([^\/]+)\/(.+)/, routes.get);
app.get(/^\/([^\/]+)\/([^\/]+)\/(.+)/, routes.get);

server = http.createServer(app).listen(app.get('port'), function(){
  log.info('Express server listening on port ' + app.get('port'));
});

function clean_exit() {
    server.close(function() {
        process.exit(0);
    });
}
process.on('SIGINT', clean_exit);
process.on('SIGTERM', clean_exit);