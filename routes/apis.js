'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');
var pluginUtils = require('./pluginUtils');

router.get('/', function (req, res, next) {
    var apis = utils.loadApis(req.app);
    var plans = utils.loadPlans(req.app);
    var groups = utils.loadGroups(req.app);
    res.render('apis',
        {
            configPath: req.app.get('config_path'),
            envFile: req.app.get('env_file'),
            title: 'wicked - Kickstarter',
            apis: apis.apis,
            plans: plans.plans,
            groups: groups.groups
        });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;
    var body = utils.jsonifyBody(req.body);
    
    if ("addApi" == body.__action) {
        console.log("Add API");
        
        let apis = utils.loadApis(req.app);
        let newApiId = body.newApiId;
        if (newApiId.length < 3)
            return next(utils.makeError(400, 'API ID must be longer than or equal 3 characters.'));
        if (!/^[a-z\-_]+$/.test(newApiId))
            return next(utils.makeError(400, 'API ID can only contain a-z, - and _.'));
        apis.apis.push({
            id: newApiId,
            name: newApiId,
            desc: newApiId,
            auth: "key-auth",
            tags: [],
            plans: []
        });
        
        utils.prepareNewApi(req.app, newApiId);
        utils.saveApis(req.app, apis);
        
        return res.redirect(redirect);
    } else if ("deleteApi" == body.__action) {
        let apiIndex = Number(body.__object);
        
        let apis = utils.loadApis(req.app);
        let apiId = apis.apis[apiIndex].id;
        apis.apis.splice(apiIndex, 1);
        utils.saveApis(req.app, apis);
        utils.removeApiDir(req.app, apiId);
        
        return res.redirect(redirect);
    }
    
    
    for (var i=0; i<body.apis.length; ++i) {
        let thisApi = body.apis[i];
        let tags = thisApi.tags.split(',');
        if (thisApi.tags !== '')
            thisApi.tags = tags;
        else
            thisApi.tags = [];
        
        let plans = [];
        for (let planName in thisApi.plans)
            plans.push(planName);
        thisApi.plans = plans;
    }

    let apis = utils.loadApis(req.app);
    apis.apis = body.apis;
    for (let i=0; i<apis.apis.length; ++i) {
        if (apis.apis[i].requiredGroup == '<none>')
            delete apis.apis[i].requiredGroup;
    }
    
    utils.saveApis(req.app, apis);

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.apis = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

router.get('/:apiId', function(req, res, next) {
    var apiId = req.params.apiId;
    var config = utils.loadApiConfig(req.app, apiId);
    var envDict = utils.loadEnvDict(req.app);
    //utils.mixinEnv(config.api, envVars);
    utils.mixinEnv(config.api, envDict);
    var apis = {};
    var safeApiId = apiId.replace(/\-/g, '');
    apis[safeApiId] = { api: config.api };
    var plugins = pluginUtils.makeViewModel(config.plugins);
    console.log(JSON.stringify(plugins, null, 2));
    res.render('apiconfig',
        {
            configPath: req.app.get('config_path'),
            apiId: apiId,
            safeApiId: safeApiId,
            apis: apis,
            plugins: plugins
        });
});

router.post('/:apiId', function(req, res, next) {
    var apiId = req.params.apiId;
    var redirect = req.body.redirect;
    var safeApiId = apiId.replace(/\-/g, '');
    
    var envVars = utils.loadEnvDict(req.app);

    var body = utils.jsonifyBody(req.body);
    //console.log(JSON.stringify(body, null, 2));
    
    var plugins = pluginUtils.makePluginsArray(body.plugins);
    //console.log(JSON.stringify(plugins, null, 2));
    
    var config = {
        api: body.apis[safeApiId].api,
        plugins: plugins 
    };
    utils.mixoutEnv(config.api, envVars, 'PORTAL_APIS_' + safeApiId.toUpperCase());
    console.log(JSON.stringify(config, null, 2));
    
    utils.saveApiConfig(req.app, apiId, config);
    utils.saveEnvDict(req.app, envVars, "default");
    
    res.redirect(redirect);
});

module.exports = router;
