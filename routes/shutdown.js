'use strict';

var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
    console.log('Received /shutdown, closing server.');
    res.send('Kickstarter has been shut down.');
    process.exit(0);
});

module.exports = router;