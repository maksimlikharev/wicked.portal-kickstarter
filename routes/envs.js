'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var router = express.Router();
var envReader = require('portal-env');

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var kickstarter = utils.loadKickstarter(req.app);
    var envDict = utils.loadEnvDict(req.app);

    res.render('envs',
        {
            configPath: req.app.get('config_path'),
            envs: kickstarter.envs,
            envDict: envDict
        });
});

router.post('/', function (req, res, next) {
    var body = utils.jsonifyBody(req.body);
    var kickstarter = utils.loadKickstarter(req.app);
    console.log(body);
    var newEnvId = body.new_env;
    if (!/^[a-z0-9\-]+$/.test(newEnvId)) {
        var err = new Error('Invalid environment name; must only contain a-z, 0-9 and hyphen (-).');
        err.status = 400;
        throw err;
    }
    utils.createEnv(req.app, newEnvId);
    kickstarter.envs.push(newEnvId);
    kickstarter.env = 3;
    utils.saveKickstarter(req.app, kickstarter);
    
    res.redirect('/envs/' + newEnvId);
});

router.get('/:envId', function (req, res, next) {
    var usedEnvVars = {};
    envReader.gatherEnvVarsInDir(req.app.get('config_path'), usedEnvVars);
    usedEnvVars.PORTAL_API_AESKEY = ['(implicit)'];

    var envDict = utils.loadEnvDict(req.app, usedEnvVars);
    var envId = req.params.envId;
    // console.log(usedEnvVars);

    res.render('env',
        {
            configPath: req.app.get('config_path'),
            envId: envId,
            envDict: envDict,
            usedVars: usedEnvVars
        });
});

router.post('/:envId', function (req, res, next) {
    var envId = req.params.envId;
    var body = utils.jsonifyBody(req.body);
    //console.log(body);

    var envDict = utils.loadEnvDict(req.app);
    var updateDict = {};
    for (let propName in body) {
        let prop = body[propName];
        if (envId != 'default' &&
            !prop.override &&
            !prop.deleted)
            continue;
        updateDict[propName] = { value: prop.value };
        if (prop.encrypted)
            updateDict[propName].encrypted = true;
    }

    envDict[envId] = updateDict;

    // Any deleted env vars?
    var saveAll = false;
    if (envId == 'default') {
        for (let propName in body) {
            let prop = body[propName];
            if (!prop.deleted)
                continue;
            console.log('Deleting env var ' + propName);
            for (let envName in envDict) {
                let env = envDict[envName];
                if (env[propName]) {
                    console.log(' * in environment ' + envName);
                    delete env[propName];
                    saveAll = true;
                }
            }
        }
    }

    //console.log(envDict["default"]);

    if (!saveAll) {
        utils.saveEnvDict(req.app, envDict, envId);
    } else {
        for (var envName in envDict)
            utils.saveEnvDict(req.app, envDict, envName);
    }

    res.redirect('/envs/' + envId);
});

router.post('/:envId/delete', function (req, res, next) {
    // I hope the user knows what he's doing. But there's always git.
    var envId = req.params.envId;
    var kickstarter = utils.loadKickstarter(req.app);
    var newEnvs = [];
    for (var i=0; i<kickstarter.envs.length; ++i) {
        if (kickstarter.envs[i] == envId)
            continue;
        newEnvs.push(kickstarter.envs[i]);
    }
    kickstarter.envs = newEnvs;
    utils.deleteEnv(req.app, envId);

    kickstarter.env = 3;
    utils.saveKickstarter(req.app, kickstarter);
    res.redirect('/envs');
});

module.exports = router;