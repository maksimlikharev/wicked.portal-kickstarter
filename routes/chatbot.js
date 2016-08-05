'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    res.render('chatbot',
        {
            configPath: req.app.get('config_path'),
            glob: glob
        });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;

    var body = utils.jsonifyBody(req.body);

    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    glob.chatbot = body.glob.chatbot;
    utils.mixoutEnv(glob, envVars);
    
    if ("deleteHook" == body.__action) {
        var index = Number(body.__object);
        glob.chatbot.hookUrls.splice(index, 1);
    } else if ("addHook" == body.__action) {
        glob.chatbot.hookUrls.push('https://url.to.your.slack/hookidentifierwhichisasecrect');
    }
    
    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.chatbot = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
