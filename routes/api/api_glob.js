'use strict';

var express = require('express');
var router = express.Router();
var envReader = require('portal-env');

var utils = require('../utils');

router.get('/', function (req, res, next) {
    const glob = utils.loadGlobals();
    return res.json(glob);
});

router.get('/hosts', function (req, res, next) {
    const glob = utils.loadGlobals(req.app);
    const envDict = utils.loadEnvDict(req.app);
    const kick = utils.loadKickstarter(req.app);
    const hosts = {};
    for (let e in kick.envs) {
        const env = kick.envs[e];
        const schema = utils.resolveByEnv(envDict, env, glob.network.schema);
        const apiHost = utils.resolveByEnv(envDict, env, glob.network.apiHost);
        const portalHost = utils.resolveByEnv(envDict, env, glob.network.portalHost);
        hosts[env] = {
            apiHost: `${schema}://${apiHost}`,
            portalHost: `${schema}://${portalHost}`
        };
    }
    return res.json(hosts);
});

module.exports = router;