'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    if (!glob.mailer.smtpPort)
        glob.mailer.smtpPort = 465;
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    res.render('email',
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
    if (body.glob.mailer.smtpPort) {
        console.log(body.glob.mailer.smtpPort);
        body.glob.mailer.smtpPort = Number(body.glob.mailer.smtpPort);
        console.log(body.glob.mailer.smtpPort);
    }
    glob.mailer = body.glob.mailer;
    
    utils.mixoutEnv(glob, envVars);
    
    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.email = 3;
    if (!glob.mailer.useMailer)
        kickstarter.email = 2;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
