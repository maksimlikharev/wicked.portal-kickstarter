'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');
var pluginUtils = require('./pluginUtils');

router.get('/', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    const authServerNames = utils.getAuthServers(req.app); // array of strings

    res.render('authservers',
        {
            configPath: req.app.get('config_path'),
            glob: glob,
            authServers: authServerNames
        });
});

router.post('/', function (req, res, next) {
    var body = utils.jsonifyBody(req.body);
    const serverName = body.servername;

    utils.createAuthServer(req.app, serverName);
    res.redirect('/authservers/' + serverName);
});

router.get('/:serverId', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    const serverId = req.params.serverId;
    const authServerInfo = utils.loadAuthServer(req.app, req.params.serverId);
    const safeServerId = utils.makeSafeId(serverId);
    // This looks weird, but the point with this is to get different names for the
    // possible env variables; otherwise they would overwrite eachother.
    const authServerInfoWithName = {};
    authServerInfoWithName[safeServerId] = authServerInfo;
    let origPlugins = [];
    if (authServerInfo.config && authServerInfo.config.plugins)
        origPlugins = authServerInfo.config.plugins;
    const plugins = pluginUtils.makeViewModel(origPlugins);

    res.render('authserver', {
        configPath: req.app.get('config_path'),
        glob: glob,
        serverId: serverId,
        safeServerId: safeServerId,
        authServer: authServerInfoWithName,
        plugins: plugins
    });
});

router.post('/:serverId', function (req, res, next) {
    var redirect = req.body.redirect;
    const serverId = req.params.serverId;
    const body = utils.jsonifyBody(req.body);

    const safeServerId = utils.makeSafeId(serverId);
    const authServer = utils.loadAuthServer(req.app, serverId);
    const updatedInfo = body.authServer[safeServerId];
    authServer.desc = updatedInfo.desc;
    authServer.url = updatedInfo.url;
    authServer.config = updatedInfo.config;

    const pluginsArray = pluginUtils.makePluginsArray(body.plugins);
    authServer.config.plugins = pluginsArray;
    console.log(JSON.stringify(authServer, null, 2));

    utils.saveAuthServer(req.app, serverId, authServer); 

    res.redirect(redirect);
});

module.exports = router;
