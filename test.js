"use strict";
const yakkety = require('./');

function fail(msg) {
	var e = new Error('TestError: ' + msg);
	console.error( e );
	process.exit(1);
}


// server
var server = new yakkety.server();

server.bind({ protocol: 'ws', slowHandshake: true, port: 8989 });

// auth clients:
server.on('authorize', function(client) {
  //console.log('server: authorize client');
  
 	if ( !client.headers.authorization ) {
		client.goodbye(401);
		fail('server, invalid client authorization: 401');
		server.close();
	} else if ( client.headers.authorization.password === 'password' ) {
		client.handshake();
	} else {
		client.goodbye(401);
		fail('server, invalid client authorization: 401');
		server.close();
	} 
  
});

server.on('connected', function(client) {
  //console.log('server: client connected');
  
	client.request('yakMethod', 'yakkety yak?', function(err, reply) {
		if ( err ) {
			fail(err);
			return;
		}
		//console.log('server: got reply back:', reply.toString());
		client.message('this is rock and roll.');
	});
		
});

server.on('message', function(message, meta) {
  //console.log('server: server got message:', message.toString());
});

server.on('request', function(meta, req, rep) {
  //console.log('server: got request, method: ' + meta.method + ', req:', req.toString());
  rep('Yak!');
});

server.on('close', function(client) {
  //console.log('server: client close-ed');
 	server.close(function() {
  	//console.log('server: has closed');
  });
});


// client
var client = new yakkety.client();
var sock = undefined;
client.connect({ protocol: 'ws', hostname: '127.0.0.1', port: 8989, path: '/foo/bar/?hello=world', auth: 'username:password', connectOnce: true }, function(_sock) {
	sock = _sock;
});

client.on('connected', function(socket) {
	//console.log('client: connected');
});

client.message('hello');

client.on('message', function(message, meta) {
  //console.log('client: got message:', message.toString());

	client.request('yakketyyakMethod', 'yakkety?', function(err, reply) {
		if ( err ) {
			//console.log('client err');
			fail(err);
			return;
		}
		
		//console.log('client: got reply to yakkety?:', reply.toString());

		if ( reply.toString() != 'Yak!' ) fail('server reply is invalid');
		
  	sock.destroy();
	});  
  
});

client.on('request', function(meta, req, rep) {
  //console.log('client: got request, method: ' + meta.method + ', req:', req.toString());
  rep('Talking back!');
});

client.on('error', function(err) {
	//console.log('client: client-app-err', err);
	fail(err);
});

