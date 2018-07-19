'use strict';

var express = require('express');
var router = express.Router();

var apiEnvs = require('./api_envs');
var apiGlob = require('./api_glob');

// This is for AJAX calls from web pages.

router.use('/envs', apiEnvs);
router.use('/globals', apiGlob);

module.exports = router;