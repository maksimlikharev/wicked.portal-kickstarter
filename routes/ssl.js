'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('ssl',
    {
        configPath: req.app.get('config_path')
    });
});

router.post('/', function(req, res, next) {
    var redirect = req.body.redirect;

    // Do things with the POST body.


    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.ssl = 3;
    utils.saveKickstarter(req.app, kickstarter);
    
    res.redirect(redirect);
});

module.exports = router;
