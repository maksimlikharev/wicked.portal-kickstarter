'use strict';

var express = require('express');
var router = express.Router();
var utils = require('./utils');

/* GET home page. */
router.get('/', function (req, res, next) {
    var kickstarter = utils.loadKickstarter(req.app);
    res.render('index',
        {
            configPath: req.app.get('config_path'),
            kickstarter: kickstarter
        });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;

    // Do things with the POST body.

    res.redirect(redirect);
});

module.exports = router;
