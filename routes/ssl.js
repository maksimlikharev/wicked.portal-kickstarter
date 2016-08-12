'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    let glob = utils.loadGlobals(req.app);
    let hasCertificates = utils.hasCertsFolder(req.app);

    res.render('ssl', {
        configPath: req.app.get('config_path')
    });
});

router.post('/', function (req, res, next) {
    let validDays = req.body.validDays - 0; // cast to number
    console.log('validDays: ' + validDays);
    if (validDays <= 0 || isNaN(validDays)) {
        return next(new Error('Invalid validDays argument. Must be a number greater than zero.'));
    }
    try {
        utils.createCerts(req.app, validDays);    
    } catch (ex) {
        return next(new Error('utils.createCerts threw an exception: ' + ex));
    }

    res.redirect('/ssl');
});

module.exports = router;
