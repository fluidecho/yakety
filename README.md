# Yakety

[![build status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![node version][node-image]][node-url]

[travis-image]: https://api.travis-ci.org/fluidecho/yakety.png
[travis-url]: https://travis-ci.org/fluidecho/yakety
[npm-image]: https://img.shields.io/npm/v/yakety.svg?style=flat-square
[npm-url]: https://npmjs.org/package/yakety
[node-image]: https://img.shields.io/badge/node.js-%3E=_0.12-blue.svg?style=flat-square
[node-url]: http://nodejs.org/download/

Bi-directional node to node messaging and request-reply.  

Both the server and client can send and recieve messages as well as requests-replys.


## Installation

```
npm install yakety
```


## Examples

_See examples folder._

#### Server example

```js
const yakkety = require('yakety');

var options = {
  protocol: 'ws',						// or 'wss' for secure.
	slowHandshake: true,			// true: can do your own authorization and handshake or close socket.
  //key: fs.readFileSync(__dirname + '/keys/key.pem'),
  //cert: fs.readFileSync(__dirname + '/keys/cert.pem'),	
  //rejectUnauthorized: false,
  //requestCert: true
};


var server = new yakety.server();

server.bind(options);

// auth clients:
server.on('authorize', function(client) {
  console.log('authorize client');
  
  if ( !client.headers.authorization ) {
    client.goodbye(401);
  } else if ( client.headers.authorization.password === 'password' ) {
    client.handshake();
  } else {
    client.goodbye(401);
  } 
  
});

server.on('connected', function(client) {
  console.log('client connected');
  client.request('yakMethod', 'yakety yak?', function(err, reply) {
    if ( err ) {
      console.log('client.request reply error', err);
      return;
    }
    console.log('got reply back:', reply.toString());
    client.message('this is rock and roll.');
  });
});

server.on('message', function(message, meta) {
  console.log('server got message:', message.toString());
});

server.on('request', function(meta, req, rep) {
  console.log('got request, method: ' + meta.method + ', req:', req.toString());
  rep('yak!');
});

server.on('close', function(client) {
  console.log('client close-ed');
});

```

#### Client example

```js
const yakkety = require('yakety');

var options = {
  protocol: 'ws',			// or 'wss' for secure.
  hostname: '127.0.0.1',
  port: 8080,
  path: '/foo/bar/?hello=world',
  auth: 'username:password'
};

var client = new yakety.client();

client.connect(options);

client.message('hello');

client.request('yaketyyakMethod', 'yakety?', function(err, reply) {
  if ( err ) {
    console.log('client.request reply error', err);
    return;
  }
  console.log('got reply to yakety?:', reply.toString());
});

client.on('message', function(message, meta) {
  console.log('got message:', message.toString());
});

client.on('request', function(meta, req, rep) {
  console.log('got request, method: ' + meta.method + ', req:', req.toString());
  rep('Talking back!');
});

client.on('error', function(err) {
  console.log('client-app-err', err);
});

```

## Notes

Uses [naked-websocket](https://www.npmjs.com/package/naked-websocket) as the TCP/TLS network link and [SMP](https://www.npmjs.com/package/smp) for message framing, with any payload codec: String, Buffer, JSON, MsgPack, etc.  


## License

Choose either: [MIT](http://opensource.org/licenses/MIT) or [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0).

