var konphyg = require('konphyg')(__dirname + '/config');
exports.config = konphyg('config');
console.log('loading config\n');