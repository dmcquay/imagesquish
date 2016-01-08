var concurrency = require('./concurrency');
var http = require('http');

exports.proxyRequest = function(req, res, host, path, cb) {
    concurrency.proxyStreamsSemaphore.take(function() {
        var leftSem = false;
        var leaveSem = function() {
            if (!leftSem) {
                leftSem = true;
                concurrency.proxyStreamsSemaphore.leave();
            }
        };

        // S3 will attempt to use the host header as the bucket name.
        // Don't do this. By omitting this header, S3 will grab the bucket
        // name from the first slash-delimited component of the Request-URI
        // path instead, which is what we want.
        delete req.headers['host'];

        // in 10 seconds, leave the semaphore no matter what. proxy streaming should never take that long.
        setTimeout(leaveSem, 10000);

        try {
            var proxyReq = http.request({
                host: host,
                method: req.method,
                path: path,
                headers: req.headers
            });

            proxyReq.on('response', function (proxyRes) {
                var status = proxyRes.statusCode;
                if (status != 200 && status != 304 && cb) {
                    proxyReq.abort();
                    leaveSem();
                    cb('Proxy request returned non 200 response.');
                } else {
                    proxyRes.on('data', function (chunk) {
                        res.write(chunk, 'binary');
                    });
                    proxyRes.on('end', function () {
                        res.end();
                        leaveSem();
                        cb && cb();
                    });
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                }
                res.on('close', function () {
                    proxyReq.abort();
                    leaveSem();
                });
            });
            proxyReq.end();
        } catch(err) {
            leaveSem();
            throw err;
        }
    });
};