'use strict';

var fs = require('fs');

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/*', function (req, res, next) {
    var pathUri = req.path;
    if (!/^[a-zA-Z\-_\/\.]+$/.test(pathUri))
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    if (/\.\./.test(pathUri))
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });

    var filePath = utils.getContentFileName(req.app, pathUri);
    var isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }

    var mdPath = filePath + '.md';
    var jadePath = filePath + '.jade';
    var mdExists = fs.existsSync(mdPath);
    var jadeExists = fs.existsSync(jadePath);
    if (!mdExists && !jadeExists)
        return next(utils.makeError(404, 'Not found.'));

    var contentPath = mdPath;
    if (!mdExists)
        contentPath = jadePath;
    var content = fs.readFileSync(contentPath, 'utf8');
    var contentType = mdExists ? 'markdown' : 'jade';
    
    res.render('content_edit', {
        configPath: req.app.get('config_path'),
        pathUri: pathUri,
        content: content,
        contentType: contentType
    });
});

router.post('/*', function (req, res, next) {
    var pathUri = req.path;
    var redirect = req.body.redirect;
    if (!/^[a-zA-Z\-_\/\.]+$/.test(pathUri))
        return res.status(404).jsonp({ message: "Not found: " + pathUri });
    if (/\.\./.test(pathUri))
        return res.status(400).jsonp({ message: "Bad request. Baaad request." });

    var filePath = utils.getContentFileName(req.app, pathUri);
    var isIndex = false;
    if (pathUri == '/index') {
        filePath = utils.getContentIndexFileName(req.app);
        isIndex = true;
    }

    if (req.body.contentType == 'markdown') {
        var mdPath = filePath + '.md';
        if (!fs.existsSync(mdPath))
            return next(utils.makeError(404, 'Not found.'));

        var markdown = req.body.content;
        
        fs.writeFileSync(mdPath, markdown, 'utf8');
    } else { // contentType == 'jade'
        var jadePath = filePath + '.jade';
        if (!fs.existsSync(jadePath))
            return next(utils.makeError(404, 'Jade not found.'));
        var jadeContent = req.body.content;
        fs.writeFileSync(jadePath, jadeContent, 'utf8');
    }
    
    res.redirect(redirect);
});

module.exports = router;