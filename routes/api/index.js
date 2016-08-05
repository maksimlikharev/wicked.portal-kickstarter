'use strict';

var express = require('express');
var router = express.Router();

var apiEnvs = require('./api_envs');

// This is for AJAX calls from web pages.

router.use('/envs', apiEnvs);

module.exports = router;