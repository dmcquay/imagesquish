var express = require('express');
var routes = require('./routes');
var http = require('http');

var app = express();

// global settings
app.set('port', process.env.PORT || 3000);

// middleware
app.use(app.router);
app.use(express.logger());

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routes
app.post('/:bucket/upload', routes.upload);
app.get('/:bucket/:imgId', routes.get);
app.get('/:bucket/:imgId/:manipulation', routes.get);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
