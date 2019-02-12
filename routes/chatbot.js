'use strict';

const express = require('express');
const router = express.Router();
const { debug, info, warn, error } = require('portal-env').Logger('kickstarter:chatbot');

const utils = require('./utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    if (!glob.chatbot.hookUrls) {
        glob.chatbot.hookUrls = [];
    }

    res.render('chatbot',
        {
            configPath: req.app.get('config_path'),
            glob: glob
        });
});

router.post('/', function (req, res, next) {
    const redirect = req.body.redirect;

    const body = utils.jsonifyBody(req.body);

    const glob = utils.loadGlobals(req.app);
    const envVars = utils.loadEnvDict(req.app);
    glob.chatbot = body.glob.chatbot;
    utils.mixoutEnv(glob, envVars);

    if ("deleteHook" == body.__action) {
        const index = Number(body.__object);
        glob.chatbot.hookUrls.splice(index, 1);
    } else if ("addHook" == body.__action) {
        if (!glob.chatbot.hookUrls) {
            glob.chatbot.hookUrls = [];
        }
        glob.chatbot.hookUrls.push('https://url.to.your.slack/hookidentifierwhichisasecrect');
    }

    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    const kickstarter = utils.loadKickstarter(req.app);
    kickstarter.chatbot = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
