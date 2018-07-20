'use strict';

var express = require('express');
var router = express.Router();
var path = require('path');

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    
    // var localStaticPath = req.app.get('config_path');
    // var localDynamicPath = path.join(path.join(localStaticPath, '..'), 'dynamic');
    
    res.render('database',
        {
            configPath: req.app.get('config_path'),
            // localStaticPath: localStaticPath,
            // localDynamicPath: localDynamicPath,
            glob: glob
        });
});

router.post('/api', function (req, res, next) {
    var body = utils.jsonifyBody(req.body);
    var glob = utils.loadGlobals(req.app);

    glob.storage = body.glob.storage;
    glob.sessionStore = body.glob.sessionStore;
    
    utils.saveGlobals(req.app, glob);

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.database = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.json({ message: 'OK' });
});

module.exports = router;
