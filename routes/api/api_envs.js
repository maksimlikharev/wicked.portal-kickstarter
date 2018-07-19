'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var router = express.Router();
var envReader = require('portal-env');

var utils = require('../utils');

router.get('/', function (req, res, next) {
    const envVar = req.query.env_var;
    if (!envVar)
        return res.status(400).json({ message: 'Invalid request; requires ?env_var=... parameter' });
    const envVars = utils.loadEnvDict(req.app);
    const envMap = {};
    let isMultiline = false;
    for (let e in envVars) {
        if (envVars[e].hasOwnProperty(envVar)) {
            const v = envVars[e][envVar];
            if (typeof v === 'string' && v.indexOf('\n') >= 0)
                isMultiline = true;
            envMap[e] = {
                defined: true,
                value: v
            };
        } else {
            envMap[e] = {
                defined: false
            };
        }
    }
    res.json({
        multiline: isMultiline,
        envs: envMap
    });
});

router.post('/:envId', function (req, res, next) {
    try {
        var envId = req.params.envId;
        var envVars = utils.loadEnvDict(req.app);
        var body = utils.jsonifyBody(req.body);
        console.log(body);

        if (!envVars[envId])
            return res.status(404).json({ message: 'Env ' + envId + ' not found.' });
        var env = envVars[envId];
        var name = body.name;
        var value = body.value;
        var encrypted = body.encrypted;

        if (!env[name])
            env[name] = {};
        env[name].value = value;
        env[name].encrypted = encrypted;
        utils.saveEnvDict(req.app, envVars, envId);

        res.status(200).json({ status: 200, message: 'OK' });
    } catch (ex) {
        console.error(ex);
        res.status(500).json({ message: ex.message });
    }
});


module.exports = router;