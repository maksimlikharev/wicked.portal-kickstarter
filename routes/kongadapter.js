'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);
    res.render('kongadapter',
        {
            configPath: req.app.get('config_path'),
            glob: glob
        });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;
   // console.log(req.body);
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);

    var body = utils.jsonifyBody(req.body);
    glob.kongAdapter = body.glob.kongAdapter;
    body.glob.kongAdapter.ignoreList = body.glob.kongAdapter.ignoreList.split(',');

    utils.mixoutEnv(glob, envVars);
    
    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.kongAdapter = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
