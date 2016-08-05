'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    utils.mixinEnv(glob, envVars);
    
    var groups = utils.loadGroups(req.app);
    
    res.render('users',
        {
            configPath: req.app.get('config_path'),
            glob: glob,
            groups: groups.groups
        });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;

    var body = utils.jsonifyBody(req.body);
    
    var groups = utils.loadGroups(req.app);
    if (body.glob.initialUsers) {
        for (let userIndex = 0; userIndex < body.glob.initialUsers.length; ++userIndex) {
            var groupsList = [];
            for (var i=0; i < groups.groups.length; ++i) {
                var groupId = groups.groups[i].id;
                if (body.glob.initialUsers[userIndex].groups &&
                    body.glob.initialUsers[userIndex].groups[groupId])
                    groupsList.push(groupId);
            }
            body.glob.initialUsers[userIndex].groups = groupsList;
        }
    }
    
    //console.log(JSON.stringify(body, null, 2));
    if ("addUser" == body.__action) {
        console.log("Adding user.");
        body.glob.initialUsers.push({
            id: utils.createRandomId(),
            firstName: "New",
            lastName: "User",
            email: "bar@foo.com",
            password: "password",
            groups: []
        });
    } else if ("deleteUser" == body.__action) {
        let userIndex = Number(body.__object);
        body.glob.initialUsers.splice(userIndex, 1);
    }

    var glob = utils.loadGlobals(req.app);
    var envVars = utils.loadEnvDict(req.app);
    glob.initialUsers = body.glob.initialUsers;
    
    utils.mixoutEnv(glob, envVars);
    
    utils.saveGlobals(req.app, glob);
    utils.saveEnvDict(req.app, envVars, "default");

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.users = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
