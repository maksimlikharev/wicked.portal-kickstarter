'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var groups = utils.loadGroups(req.app);
    var glob = utils.loadGlobals(req.app);
    console.log(JSON.stringify(groups, null, 2));
    var userGroup = null;
    if (!glob.validatedUserGroup)
        userGroup = '<none>';
    else
        userGroup = glob.validatedUserGroup;

    for (var i=0; i<groups.groups.length; ++i)
        groups.groups[i].alt_ids = groups.groups[i].alt_ids.join(','); 
    
    res.render('groups',
        {
            configPath: req.app.get('config_path'),
            groups: groups.groups,
            validatedUserGroup: userGroup
        });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;
    // Do things with the POST body.
    console.log(JSON.stringify(req.body, null, 2));

    var body = utils.jsonifyBody(req.body);
    var groups = {
        groups: body.groups
    };
    for (var i=0; i<groups.groups.length; ++i) {
        if (groups.groups[i].alt_ids)
            groups.groups[i].alt_ids = groups.groups[i].alt_ids.split(',');
        else
            groups.groups[i].alt_ids = [];
    } 
    if (body.__action == 'addGroup')
        groups.groups.push({
            id: 'newgroup',
            name: 'New Group',
            alt_ids: [],
            adminGroup: false
        });
    else if (body.__action == 'deleteGroup') {
        var indexToDelete = Number(body.__object);
        groups.groups.splice(indexToDelete, 1);
    }
        
    utils.saveGroups(req.app, groups);

    // Changes to validated user group?
    var validatedGroup = body.validatedUserGroup;
    if (validatedGroup == '<none>')
        validatedGroup = null;
    var glob = utils.loadGlobals(req.app);
    if (glob.validatedUserGroup != validatedGroup) {
        if (!validatedGroup)
            delete glob.validatedUserGroup;
        else
            glob.validatedUserGroup = validatedGroup;
        utils.saveGlobals(req.app, glob);
    }

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.groups = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
