"use strict";
//
// yakety - client example
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
  protocol: 'ws',      // or 'wss' for secure.
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
