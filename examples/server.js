"use strict";
//
// yakety - server example
//
// Version: 0.0.6
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2017 Mark W. B. Ashcroft.
// Copyright (c) 2017 FluidEcho.
//


const yakety = require('..');


var options = {
  protocol: 'ws',            // or 'wss' for secure.
  slowHandshake: true,      // true: can do your own authorization and handshake or close socket.
  port: 8080,
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

  client.on('message', function(message, meta) {
    console.log('server got message:', message.toString());
  });

  client.on('request', function(meta, req, rep) {
    console.log('got request, method: ' + meta.method + ', req:', req.toString());
    rep('yak!');
  });

  client.on('close', function(client) {
    console.log('client close-ed');
  });

});
