'use strict';

var express = require('express');
var router = express.Router();
var mustache = require('mustache');

var utils = require('./utils');

function fwibbleHost(host) {
    if (host.startsWith('$') && !host.startsWith('${'))
        return '${' + host.substring(1) + '}';
    return host;
}

function decodeHtmlEntity(str) {
    return str.replace(/&#(\d+);/g, function (match, dec) {
        return String.fromCharCode(dec);
    });
}

/* GET home page. */
router.get('/', function (req, res, next) {

    var dockerComposeFile = utils.readDockerComposeFile(req.app);
    var dockerFile = utils.readDockerfile(req.app);

    let hasDockerFiles = dockerComposeFile && dockerFile;
    let glob = utils.loadGlobals(req.app);

    let apiHost = fwibbleHost(glob.network.apiHost);
    let portalHost = fwibbleHost(glob.network.portalHost);
    let portalHostVarName = utils.resolveEnvVarName(glob.network.portalHost.trim(), 'PORTAL_NETWORK_PORTALHOST');
    let apiHostVarName = utils.resolveEnvVarName(glob.network.apiHost.trim(), 'PORTAL_NETWORK_APIHOST');
    let dockerTag = utils.getVersion();

    res.render('deploy', {
        configPath: req.app.get('config_path'),
        hasDockerFiles: hasDockerFiles,
        dockerTag: dockerTag,
        dockerComposeFile: dockerComposeFile,
        dockerFile: dockerFile,
        apiHost: apiHost,
        apiHostVarName: apiHostVarName,
        portalHost: portalHost,
        portalHostVarName: portalHostVarName
    });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;

    var body = utils.jsonifyBody(req.body);

    // Do things with the POST body.
    console.log(body);
    if (body.createDockerfiles) {
        if (body.alpine)
            body.buildAlpine = "-alpine";
        // Create new Dockerfiles
        var composeTemplate = utils.readDockerComposeTemplate(req.app);
        var dockerfileTemplate = utils.readDockerfileTemplate(req.app);

        var composeContent = mustache.render(composeTemplate, body);
        var dockerfileContent = mustache.render(dockerfileTemplate, body);

        utils.writeDockerComposeFile(req.app, composeContent);
        utils.writeDockerfile(req.app, dockerfileContent);

    } else if (body.editDockerfiles) {
        // Edit the Dockerfiles
        utils.writeDockerComposeFile(req.app, body.composeFile);
        utils.writeDockerfile(req.app, body.dockerFile);
    }

    // Write changes to Kickstarter.json
    var kickstarter = utils.loadKickstarter(req.app);
    kickstarter.deploy = 3;
    utils.saveKickstarter(req.app, kickstarter);

    res.redirect(redirect);
});

module.exports = router;
