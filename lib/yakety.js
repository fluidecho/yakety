"use strict";
//
// yakety
//
// Version: 0.0.3
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2016 Mark W. B. Ashcroft.
// Copyright (c) 2016 FluidEcho.
//


const preview = require('preview')('yakety');

const client = require('./client');
const server = require('./server');

exports.client = client;
exports.server = server;

