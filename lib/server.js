"use strict";
//
// yakety - server
//
// Version: 0.0.4
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2016 Mark W. B. Ashcroft.
// Copyright (c) 2016 FluidEcho.
//


const preview       = require('preview')('yakety-server');
const nws						= require('naked-websocket');
const smp           = require('smp');
const stream 				= smp.StreamParser;
const util					= require('util');
const events        = require('events');
const EventEmitter  = events.EventEmitter;
const crypto				= require('crypto');
    


var YaketyServer = function () {
	preview('YaketyServer');
	
	var self = this;
	
	this.options = {
		hostname: '',
		port: 8989,
		path: '',
		slowHandshake: false,
		maxbuffer: 4000,        // max header size, 4000 = 4 KB.
		version: '0.0.1',       // must be same on all peers.
		protocol: 'ws',         // 'wss' = secure (TLS), must be same on all peers.
		timedout: 15000,        // how long to wait for connection, 15 seconds.
		req_retries: 3,						// int, how many attemps to send request to make before err
		req_rety_timedout: 1000, 	// ms, how long to wait between send request attemps.
		headers: {
			'yakety': '0.0.1',
			Codec: 'nws+smp-super-0+yakety',		// Naked Websocket + Streaming message Protocol - Supper (Protocol) - Version (ident) + yakety.
			'Codec-Encoding': 'utf8'
		},		
		ident: 0,		// SMP.Super.Ident = 0:15 Protocol Version Number
		schemaURL: 'https://git.io/v1yU0'		// SMP.Super.Schema (https://github.com/fluidecho/yakety/tree/v0.0.1)
	};  

	EventEmitter.call(self);
		
	this.clients = {};

	this.server = undefined;

	this.close = function close(cb) {
		preview('closing down server');
		this.server.close(function() {
			if ( cb != undefined ) cb(true);
		});	
	};

	this.bind = function bind(opts, cb) {
	
		for ( var o in opts ) {
			if ( this.options[o] != undefined ) {
				this.options[o] = opts[o];
			}
		}	

		preview('createServer', this.options);

		_createServer(this, function(_sock) {
		
		});
		
		return self;
		
	};

	return self;
};




util.inherits(YaketyServer, events.EventEmitter); 
module.exports = YaketyServer;



function _createServer(_this, fn) {

  var self = _this;

	self.server = nws.createServer(_this.options, function(socket) {
	
		preview('client connect');
		
		// if auth clients:
		if ( self.options.slowHandshake ) self.emit('authorize', socket);
		
		if ( socket.handshaked === false ) return false;
	
		preview('client connected and handshaked');
	
		// add this client:
		let cl = "" + socket.client.hostname + ':' + socket.client.port + "";		// as string

		self.clients[cl] = {
			socket: socket,
			queue: [],
			parser: new stream({chunking_timeout: 10000, namespace: 'server'}),
			registered_requests: {}
		};
		
		self.clients[cl].message = function (msg, method) {
		
			var meta = {};
			meta.type = 'message',
			meta.id = crypto.createHash('md5').update(crypto.randomBytes(256)).digest('hex');		// 'hex'
			if ( method ) meta.method = method;
		
			var binmsg = smp.super( new Buffer(JSON.stringify(meta)), new Buffer(msg), new Buffer(self.options.schemaURL), self.options.ident );		// arg[0] = id, arg[1] = payload message data
			preview('binmsg', binmsg);
				
			self.clients[cl].socket.write(binmsg);
		
		};
		
		self.clients[cl].request = function (method, req, rep) {
				
			preview('send self.client, request func...');
				
			var meta = {};
			meta.type = 'request',
			meta._id = crypto.createHash('md5').update(crypto.randomBytes(256)).digest('hex');		// random id
			meta.method = undefined;
			if ( method ) meta.method = method;
		
			self.clients[cl].registered_requests[meta._id] = { meta: meta, req: req, rep: rep, tries: 1 };
		
			//this.registered_requests[meta._id] = { meta: meta, req: req, rep: rep, timedout: setTimeout(function() {
			//		retry(meta.id);
			//}, 1000), tries: 1 };		// if too many tries err
		
			var binmsg = smp.super( new Buffer(JSON.stringify(meta)), new Buffer(req), new Buffer(self.options.schemaURL), self.options.ident );		// arg[0] = id, arg[1] = payload message data
			preview('binmsg', binmsg);
		
			self.clients[cl].socket.write(binmsg);

		};
		
		
		self.clients[cl].parser.on('super', function(message){
		  
		  preview('super message', message);
		  
		  var meta = JSON.parse(message.meta.toString('utf8'));
		  meta.ident = message.ident;
		  meta.schema = message.schema.toString();
		  preview('meta', meta);
		  
		  if ( meta.type === 'message' )	self.emit('message', message.payload, meta);

		 	if ( meta.type === 'reply' ) {
		 		// match with registered callback.
		 		if ( self.clients[cl].registered_requests[meta._id] == undefined ) {
		 			preview('not valid reply id! maybe has allready been handled.');
		 		} else {
		 			clearTimeout(self.clients[cl].registered_requests[meta._id].timedout);
		 			self.clients[cl].registered_requests[meta._id].rep( null, message.payload );		// callback the reply function with returned data!
		 			delete self.clients[cl].registered_requests[meta._id];
		 		}
		 	}
		  
		  if ( meta.type === 'request' ){
		  
		  	self.emit('request', meta, message.payload, function(rep) {
					// send reply to client...
					preview('replying: ' + rep);
					if ( !Buffer.isBuffer(rep) ) rep = new Buffer(rep);
					meta.type = 'reply';		// change from req to rep.
					var binmsg = smp.super( new Buffer(JSON.stringify(meta)), rep, new Buffer(self.options.schemaURL), self.options.ident );		// arg[0] = id, arg[1] = payload message data
					preview('binmsg', binmsg);
					self.clients[cl].socket.write(binmsg);	
				});		
		  }
		  
		});
		
		
		self.clients[cl].parser.on('frame', function(frame){
		  preview('message', frame);
		});
		socket.pipe(self.clients[cl].parser);	

		socket.on('close', function() {
			preview('client closed');
			self.emit('close', self.clients[cl]);
			delete self.clients[cl];
		});

		//socket.on('data', function(chunk) {
		//	preview('data, chunk', chunk.toString());
		//});
		
		self.emit('connected', self.clients[cl]);	
		
	});


	self.server.listen(self.options.port, function() {
		preview('server bound');
		return this.server;   // return the server object.
	});


}



