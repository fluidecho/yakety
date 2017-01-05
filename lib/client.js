"use strict";
//
// yakety - client
//
// Version: 0.0.7
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2017 Mark W. B. Ashcroft.
// Copyright (c) 2017 FluidEcho.
//


const preview       = require('preview')('yakety-client');
const nws           = require('naked-websocket');
const smp           = require('smp');
const stream        = smp.StreamParser;
const util          = require('util');
const events        = require('events');
const EventEmitter  = events.EventEmitter;
const crypto        = require('crypto');

const ignore_errors = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EPIPE',
  'ENOENT'
];


var YaketyClient = function () {
  preview('YaketyClient');

  var self = this;

  this.options = {
    hostname: '',
    port: 8989,
    path: '',
    maxbuffer: 4000,            // nws, max header size, 4000 = 4 KB.
    version: '0.0.1',           // nws, must be same on all peers.
    protocol: 'ws',             // nws, 'wss' = secure (TLS), must be same on all peers.
    requestTimedout: 5000,      // ms, how long to wait for request to reply.
    connectTimedout: 3000,      // ms, how long to wait before trying to re-connect.
    maxconnectTimedout: 30000,  // ms, maximum time to try establishing connection.
    connectOnce: false,          // bool, if true will not attempt to reconnect on close.
    timedout: Infinity,          // nws, how long to wait for connection, 15 seconds.
    auth: '',                    // nws, authorization
    headers: {
      'yakety': '0.0.1',
      Codec: 'nws+smp-super-0+yakety',    // Naked Websocket + Streaming message Protocol - Supper (Protocol) - Version (ident) + yakety.
      'Codec-Encoding': 'utf8'
    },
    ident: 0,    // SMP.Super.Ident = 0:15 Protocol Version Number
    schemaURL: 'https://git.io/v1yU0'    // SMP.Super.Schema (https://github.com/fluidecho/yakety/tree/v0.0.1)
  };

  //for ( var o in opts ) {
  //  if ( this.options[o] != undefined ) {
  //    this.options[o] = opts[o];
  //  }
  //}

  EventEmitter.call(self);

  this.queue = [];
  this.registered_requests = {};
  this.socket = undefined;
  this.connectTimer = undefined;

  //this.parser.on('error', function(err) {
  //  this.emit('error', err);
  //});

  this.message = function (msg, method) {

    var meta = {};
    meta.type = 'message',
    meta._id = crypto.createHash('md5').update(crypto.randomBytes(256)).digest('hex');    // 'hex'
    if ( method ) meta.method = method;

    if ( !Buffer.isBuffer(msg) ) msg = new Buffer(msg);

    var binmsg = smp.super( new Buffer(JSON.stringify(meta)), msg, new Buffer(this.options.schemaURL), this.options.ident );
    preview('binmsg', binmsg);

    if ( this.socket == undefined || !this.socket.writable ) {
      preview('queue this message until socket connects');
      this.queue.push(binmsg);
    } else {
      this.socket.write(binmsg);
    }

  };


  this.request = function (method, req, rep) {

    var meta = {};
    meta.type = 'request',
    meta._id = crypto.createHash('md5').update(crypto.randomBytes(256)).digest('hex');    // random id
    meta.method = undefined;
    if ( method ) meta.method = method;

    if ( !Buffer.isBuffer(req) ) req = new Buffer(req);

    this.registered_requests[meta._id] = { meta: meta, req: req, rep: rep, tries: 1, timedout:
      setTimeout(function() {
        preview('request timedout!');
         delete self.registered_requests[meta._id];
        rep( new Error('Request timedout without response.') );    // callback error
      }, self.options.requestTimedout)
    };

    // TODO request timmer and tries++
    //this.registered_requests[meta._id] = { meta: meta, req: req, rep: rep, timedout: setTimeout(function() {
    //    retry(meta.id);
    //}, 1000), tries: 1 };    // if too many tries err

    var binmsg = smp.super( new Buffer(JSON.stringify(meta)), req, new Buffer(this.options.schemaURL), this.options.ident );    // arg[0] = id, arg[1] = payload message data
    preview('binmsg', binmsg);

    if ( this.socket == undefined || !this.socket.writable ) {
      preview('queue this message until socket connects');
      this.queue.push(binmsg);
    } else {
      this.socket.write(binmsg);
    }

  };


  this.connect = function connect(opts, cb) {

    for ( var o in opts ) {
      if ( this.options[o] != undefined ) {
        this.options[o] = opts[o];
      }
    }

    preview('connect', this.options);
    this._connect( function(sock) {
      if ( cb != undefined ) {
        cb(sock);
      }
    });

  };

  return self;
};




util.inherits(YaketyClient, events.EventEmitter);
module.exports = YaketyClient;







YaketyClient.prototype._connect = function (fn) {

  preview('_connect (ing)...');

  var self = this;

  if ( self.connectTimer === undefined ) {
    self.connectTimer = setTimeout( function() {
        if ( self.socket === undefined ) {
          // err, trying to connect has timeout!
          self.connectTimer = true;
          return self.emit('error', new Error('Connect timedout.'));
        }
      }, self.options.maxconnectTimedout);
  }

  if ( self.socket != undefined ) return;
  if ( self.connectTimer === true ) return;

  var registered_requests = {};
  var socket = undefined;

  var _client = nws.connect(this.options, function(_socket) {

    preview('client connected');

    clearTimeout(self.connectTimer);
    self.connectTimer = undefined;

    self.socket = _socket;

    //self.socket.setEncoding();

    self.socket.on('data', function(chunk) {
      preview('chunk ' + chunk);
    });

    preview('socket.headers', self.socket.headers);

    let parser = new stream({chunking_timeout: 10000, namespace: 'client'});
     self.socket.pipe(parser);

    //parser.on('frame', function(frame){
    //  preview('frame', frame);
    //});

    parser.on('super', function(message){
      preview('super message', message);

      var meta = JSON.parse(message.meta.toString('utf8'));
      meta.ident = message.ident;
      meta.schema = message.schema.toString();
      preview('meta', meta);

      if ( meta.type === 'message' )  self.emit('message', message.payload, meta);

       if ( meta.type === 'reply' ) {
         // match with registered callback.
         if ( self.registered_requests[meta._id] == undefined ) {
           preview('not valid reply id! maybe has already been handled.');
         } else {
           clearTimeout(self.registered_requests[meta._id].timedout);
           self.registered_requests[meta._id].rep( null, message.payload );    // callback the reply function with returned data!
           delete self.registered_requests[meta._id];
         }
       }

      if ( meta.type === 'request' ){
        self.emit('request', meta, message.payload, function(rep) {
          // send reply to client...
          preview('replying: ' + rep);
          if ( !Buffer.isBuffer(rep) ) rep = new Buffer(rep);
          meta.type = 'reply';    // change from req to rep.
          var binmsg = smp.super( new Buffer(JSON.stringify(meta)), rep, new Buffer(self.options.schemaURL), self.options.ident );    // arg[0] = id, arg[1] = payload message data
          preview('binmsg', binmsg);
          if ( self.socket == undefined || !self.socket.writable ) {
            preview('queue this message until socket connects');
            self.queue.push(binmsg);
          } else {
            self.socket.write(binmsg);
          }
        });
      }

    });



    if ( self.socket.body ) {    // if server body was trailing connection header, emit.
       preview('self.socket.body, trailing', self.socket.body);
      self.socket.emit('data', self.socket.body);
    }

    self.emit('connected', self.socket);

    // flush and queud messages:
    if ( self.queue.length > 0 ) {
      var x = 0;
      for ( x = 0; x < self.queue.length; x++ ) {
        preview('flushing ' + self.queue[x].length, self.queue[x].toString());
        self.socket.write(self.queue[x]);
      }
      self.queue = [];    // reset
    }

    return fn(_socket);

  });

  _client.on('error', function(err) {
    console.log('err', err);
    if (!~ignore_errors.indexOf(err.code)) return self.emit('error', err);
  });

  _client.on('close', function() {
    preview('client closed, try reconnecting...');
    self.socket = undefined;
    self.emit('close');

    if ( self.socket === undefined && self.connectTimer != true && self.options.connectOnce === false ) {
      setTimeout( function() {
        if ( self.socket === undefined ) {
            self._connect(function() {

            });
        }
      }, self.options.connectTimedout);
    }

  });


};
