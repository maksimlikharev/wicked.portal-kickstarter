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

const knownProperties = {
    'id': true,
    'desc': true,
    'config': true,
    'authMethods': true
};

function isPropertyKnown(propName) {
    return knownProperties.hasOwnProperty(propName);
}

function getUnknownProperties(serverConfig) {
    const otherProperties = {};
    for (let propName in serverConfig) {
        if (isPropertyKnown(propName))
            continue;
        otherProperties[propName] = serverConfig[propName];
    }
    return otherProperties;
}

function jsonifyAuthMethods(authMethods) {
    for (let i = 0; i < authMethods.length; ++i) {
        const am = authMethods[i];
        jsonifyObject(am);
    }
}

function jsonifyObject(ob) {
    for (let p in ob) {
        const pt = typeof ob[p];
        if (pt === 'object') {
            if (p === 'config' || p === 'endpoints') {
                jsonifyObject(ob[p]);
            } else {
                ob[p] = JSON.stringify(ob[p], null, 2);
            }
        }
    }
}

function unjsonifyObject(ob) {
    for (let p in ob) {
        const pt = typeof ob[p];
        if (pt === 'object') {
            unjsonifyObject(ob[p]);
        } else if (pt === 'string') {
            const v = ob[p];
            if (v.startsWith('{') || v.startsWith('[')) {
                try {
                    const vv = JSON.parse(v);
                    ob[p] = vv;
                } catch (err) {
                    // Don't do anything
                }
            }
        }
    }
}

router.get('/:serverId', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);

    const serverId = req.params.serverId;
    const authServerInfo = utils.loadAuthServer(req.app, req.params.serverId);
    const safeServerId = utils.makeSafeId(serverId);
    let origPlugins = [];
    if (authServerInfo.config && authServerInfo.config.plugins)
        origPlugins = authServerInfo.config.plugins;
    const plugins = pluginUtils.makeViewModel(origPlugins);
    const otherProperties = JSON.stringify(getUnknownProperties(authServerInfo), null, 2);
    // console.log(otherProperties);
    let authMethods = [];
    if (authServerInfo.authMethods) {
        authMethods = authServerInfo.authMethods;
        jsonifyAuthMethods(authMethods);
    }
    if (glob && glob.portal && glob.portal.authMethods) {
        // Mix in auth methods to auth methods here
        for (let amIndex in glob.portal.authMethods) {
            const am = glob.portal.authMethods[amIndex];
            if (typeof am !== 'string')
                continue;
            const splitPos = am.indexOf(':');
            if (splitPos < 0) {
                console.error('Invalid auth method name: ' + am + ', expected <id>:<auth method id>');
                continue;
            }
            const amServerId = am.substring(0, splitPos);
            if (amServerId !== serverId) // non-matching server
                continue;
            const amAuthMethodId = am.substring(splitPos + 1);
            console.log('Auth Method: ' + amAuthMethodId);
            const authMethod = authMethods.find(a => a.name === amAuthMethodId); // jshint ignore:line
            if (!authMethod) {
                console.warn(`Auth Method ${am} is configured for portal, but is unknown.`);
                continue;
            }
            authMethod.useForPortal = true;
        }
    }
    // console.log(authMethods);

    const viewModel = {
        configPath: req.app.get('config_path'),
        glob: glob,
        serverId: serverId,
        safeServerId: safeServerId,
        authServer: authServerInfo,
        plugins: plugins,
        authMethods: authMethods,
        otherProperties: otherProperties
    };

    res.render('authserver', viewModel);
});

function mixinUnknownProperties(serverConfig, otherProperties) {
    for (let propName in otherProperties) {
        if (isPropertyKnown(propName)) {
            console.error('Duplicate property name in auth server config: ' + propName + ', discarding.');
            continue;
        }
        serverConfig[propName] = otherProperties[propName];
    }
}

router.post('/:serverId/api', function (req, res, next) {
    const body = utils.getJson(req.body);
    console.log(JSON.stringify(body, null, 2));
    res.status(204).json({ message: 'OK' });
});

router.post('/:serverId', function (req, res, next) {
    var redirect = req.body.redirect;
    const serverId = req.params.serverId;
    console.log(req.body);
    const body = utils.jsonifyBody(req.body);
    console.log(body);

    var glob = utils.loadGlobals(req.app);

    const safeServerId = utils.makeSafeId(serverId);
    const authServer = utils.loadAuthServer(req.app, serverId);
    const updatedInfo = body.authServer[safeServerId];
    authServer.desc = updatedInfo.desc;
    authServer.url = updatedInfo.url;
    authServer.urlDescription = updatedInfo.urlDescription;
    authServer.config = updatedInfo.config;
    authServer.config.api.strip_uri = (!authServer.config.api.strip_uri) ? false : authServer.config.api.strip_uri;

    const pluginsArray = pluginUtils.makePluginsArray(body.plugins);
    authServer.config.plugins = pluginsArray;

    const authMethods = body.authMethods;
    utils.unpackObjects(authMethods);
    authServer.authMethods = authMethods;
    // Throw out all auth methods from this auth server from globals
    if (glob.portal && glob.portal.authMethods) {
        const strippedList = [];
        for (let i = 0; i < glob.portal.authMethods.length; ++i) {
            const thisAm = glob.portal.authMethods[i];
            const splitPos = thisAm.indexOf(':');
            if (splitPos < 0) {
                // wtf
                strippedList.push(thisAm);
                continue;
            }
            const thisAmServerId = thisAm.substring(0, splitPos);
            if (thisAmServerId !== serverId)
                strippedList.push(thisAm);
        }
        glob.portal.authMethods = strippedList;
    } else {
        if (glob.portal)
            glob.portal.authMethods = [];
        else
            glob.portal = { authMethods: [] };
    }
    for (let i = 0; i < authMethods.length; ++i) {
        const thisAm = authMethods[i];
        if (thisAm.useForPortal)
            glob.portal.authMethods.push(`${serverId}:${thisAm.name}`);
        if (thisAm.hasOwnProperty('useForPortal'))
            delete thisAm.useForPortal;
    }
    console.log('===========================');
    console.log(glob);
    console.log('===========================');
    console.log(JSON.stringify(authServer, null, 2));
    console.log('===========================');

    const otherProperties = JSON.parse(body.otherProperties);
    mixinUnknownProperties(authServer, otherProperties);

    utils.saveGlobals(req.app, glob);
    utils.saveAuthServer(req.app, serverId, authServer);

    res.redirect(redirect);
});

module.exports = router;
