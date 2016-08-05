'use strict';

var fs = require('fs');
var path = require('path');
var marked = require('marked');
var express = require('express');
var router = express.Router();
var jade = require('jade');

var utils = require('./utils');

router.get('/', function (req, res, next) {
    
    var uris = utils.getContentFileNames(req.app);
    
    res.render('content',
        {
            configPath: req.app.get('config_path'),
            envFile: req.app.get('env_file'),
            pathUris: uris.pathUris,
            publicUris: uris.publicUris
        });
});

router.post('/', function (req, res, next) {
    var newContent = req.body.newContent;
    if (!newContent)
        return res.redirect('/content');
    
    var fileParts = newContent.split('/');
    for (var i=0; i<fileParts.length; ++i) {
        if (!/^[a-zA-Z\-_]+$/.test(fileParts[i]))
            return next(utils.makeError(400, 'Invalid URI Path, it contains invalid characters. Allowed are only a-z, A-Z, - and _.'));
    }
    utils.createNewContent(req.app, newContent, req.body.contentType, function(err) {
        if (err)
            return next(err);
        res.redirect('/content/' + newContent);
    });
});

var _tempViewModel = {
    authUser: {
        firstName: 'Daniel',
        lastName: 'Developer',
        name: 'Daniel Developer',
        email: 'daniel@developer.com'
    },
    title: 'This is a title',
    subTitle: 'Some subtitle',
    omitContainer: false,
    showTitle: true,
    glob: {
        network: {
            schema: 'http',
            apiHost: 'api.mycompany.com',
            portalHost: 'mycompany.com'
        }
    }
};

router.get('/*', function (req, res, next) {
    var pathUri = req.path;
    if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(pathUri))
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    if (/\.\./.test(pathUri))
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });

    var filePath = utils.getContentFileName(req.app, pathUri);
    console.log(filePath);

    if (utils.isPublic(filePath.toLowerCase())) {
        if (!fs.existsSync(filePath))
            return res.status(404).jsonp({ message: 'Not found.: ' + pathUri });
        var contentType = utils.getContentType(filePath);
        // Just serve it
        fs.readFile(filePath, function (err, content) {
            res.setHeader('Content-Type', contentType);
            res.send(content);
        });
        return;
    }
    
    //console.log(pathUri);
    
    var isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }
    
    var configPath = filePath + '.json';
    var mdPath = filePath + '.md';
    var jadePath = filePath + '.jade';
    
    var mdExists = fs.existsSync(mdPath);
    var jadeExists = fs.existsSync(jadePath);
    
    if (!mdExists && !jadeExists)
        return next(utils.makeError(404, 'Not found.'));
    if (!fs.existsSync(configPath))
        return next(utils.makeError(404, 'Companion .json file not found.'));
    var contentPath = mdExists ? mdPath : jadePath;
        
    var metaInfo = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    var title = metaInfo.title;
    var subTitle = metaInfo.subTitle;
    if (!subTitle)
        subTitle = '';
    var requiredGroup = '<none>';
    if (metaInfo.requiredGroup)
        requiredGroup = metaInfo.requiredGroup;

    _tempViewModel.title = title;
    _tempViewModel.subTitle = subTitle;
    _tempViewModel.omitContainer = metaInfo.omitContainer;
    _tempViewModel.showTitle = metaInfo.showTitle;
    
    var content;
    if (mdExists)
        content = marked(fs.readFileSync(mdPath, 'utf8'));
    else
        content = jade.render(fs.readFileSync(jadePath, 'utf8'), _tempViewModel);
    
    var groups = utils.loadGroups(req.app);
    
    res.render('content_preview', {
        configPath: req.app.get('config_path'),
        envFile: req.app.get('env_file'),
        pathUri: pathUri, 
        isIndex: isIndex,
        showTitle: metaInfo.showTitle,
        omitContainer: metaInfo.omitContainer,
        title: title,
        subTitle: marked(subTitle),
        subTitleRaw: subTitle,
        content: content,
        requiredGroup: requiredGroup,
        groups: groups.groups,
        viewModel: JSON.stringify(_tempViewModel, null, 2)
    });
    //res.status(400).send('not implemented');
});

router.post('/*', function (req, res, next) {
    var pathUri = req.path;
    var redirect = req.body.redirect;

    var body = utils.jsonifyBody(req.body);

    try {
        var tempViewModel = JSON.parse(body.viewModel);
        _tempViewModel = tempViewModel;
    } catch (err) {
        console.log(err);
    }

    var filePath = utils.getContentFileName(req.app, pathUri);
    var isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }
    
    var configPath = filePath + '.json';
    var requiredGroup = null;
    if (body.requiredGroup != '<none>')
        requiredGroup = body.requiredGroup;

    console.log('requiredGroup: ' + requiredGroup);

    var configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    configJson.showTitle = body.showTitle;
    configJson.omitContainer = body.omitContainer;
    configJson.title = body.title;
    configJson.subTitle = body.subTitleRaw;
    if (requiredGroup)
        configJson.requiredGroup = requiredGroup;
    else if (!requiredGroup && configJson.requiredGroup)
        delete configJson.requiredGroup;
    
    fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2), 'utf8');

    res.redirect('/content' + pathUri);
});

module.exports = router;
