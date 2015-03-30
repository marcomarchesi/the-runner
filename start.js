/* THE RUNNER
*/

var express = require('express');
var glove = require('./Glove.js');
var app = express();
var port = 8080;

app.use(express.static(__dirname + '/public'));

var io = require('socket.io').listen(app.listen(port));

// app.listen(port);
console.log("listening port " + port);

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/public/index.html');
});