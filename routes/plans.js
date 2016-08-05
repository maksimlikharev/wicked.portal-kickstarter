'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var router = express.Router();

var utils = require('./utils');
var pluginUtils = require('./pluginUtils');

router.get('/', function (req, res, next) {
    var plans = utils.loadPlans(req.app);
    var glob = utils.loadGlobals(req.app);
    var groups = utils.loadGroups(req.app); 

    // Make the config UI friendly
    var hasPlanWithApproval = false;
    for (var i=0; i<plans.plans.length; ++i) {
        //plans.plans[i].configString = JSON.stringify(plans.plans[i].config, null, 2);
        plans.plans[i].config.plugins = pluginUtils.makeViewModel(plans.plans[i].config.plugins);
        if (plans.plans[i].needsApproval)
            hasPlanWithApproval = true;
    }
    
    res.render('plans',
        {
            configPath: req.app.get('config_path'),
            plans: plans.plans,
            glob: glob,
            groups: groups.groups,
            hasPlanWithApproval: hasPlanWithApproval
        });
});

router.post('/', function (req, res, next) {
    
    var redirect = req.body.redirect;

    var body = utils.jsonifyBody(req.body);
    var plans = {
        plans: body.plans
    };

    for (var i=0; i<plans.plans.length; ++i) {
        if (plans.plans[i].requiredGroup == '<none>')
            delete plans.plans[i].requiredGroup;
        plans.plans[i].config.plugins = pluginUtils.makePluginsArray(plans.plans[i].config.plugins);
    }

    if ("addPlan" == body.__action) {
        plans.plans.push({
            id: 'newplan',
            name: 'New Plan',
            desc: 'New Plan Description',
            needsApproval: false,
            config: {
                plugins: []
            }
        });
    }
    if ("deletePlan" == body.__action) {
        var index = Number(body.__object);
        plans.plans.splice(index, 1);
    }
    
    utils.savePlans(req.app, plans);

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.plans = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
