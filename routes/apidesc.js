'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/:apiId', function (req, res, next) {
    var apiId = req.params.apiId;
    var desc = utils.loadApiDesc(req.app, apiId);
    
    res.render('apidesc',
        {
            configPath: req.app.get('config_path'),
            desc: desc,
            apiId: apiId
        });
});

router.post('/:apiId', function (req, res, next) {
    var apiId = req.params.apiId;
    var redirect = req.body.redirect;

    // We may safely just dump this to the desc.md
    utils.saveApiDesc(req.app, apiId, req.body.desc);    

    res.redirect(redirect);
});

module.exports = router;
