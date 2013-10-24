var express = require('express');
var image = require('./routes/image');
var http = require('http');

var app = express();

// global settings
app.set('port', process.env.PORT || 3000);
app.set('s3 bucket', 'com-athlete-ezimg');

// middleware
app.use(app.router);
app.use(express.logger());

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routes
app.post('/:bucket/upload', image.upload);
app.get('/:bucket/:imgId', image.get);
app.get('/:bucket/:imgId/:manipulation', image.get);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
