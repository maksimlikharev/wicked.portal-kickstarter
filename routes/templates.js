'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

var emailTemplates = [
    { id: 'lost_password', name: 'Template for lost password recovery' },
    { id: 'pending_approval', name: 'New pending approval email template' },
    { id: 'verify_email', name: 'Email address verification template' }
];

router.get('/', function (req, res, next) {

    var chatbotTemplates = utils.loadChatbotTemplates(req.app);

    var templateArray = [];
    for (var prop in chatbotTemplates) {
        templateArray.push({
            id: prop,
            message: chatbotTemplates[prop]
        });
    }

    res.render('templates', {
        configPath: req.app.get('config_path'),
        envFile: req.app.get('env_file'),
        chatbotTemplates: templateArray,
        emailTemplates: emailTemplates
    });
});

router.post('/', function (req, res, next) {
    var redirect = req.body.redirect;
    var body = utils.jsonifyBody(req.body);
    
    var templateObject = {};
    for (var i=0; i<body.chatbotTemplates.length; ++i) {
        var t = body.chatbotTemplates[i];
        templateObject[t.id] = t.message;
    }
    
    utils.saveChatbotTemplates(req.app, templateObject);
    
    res.redirect(redirect);
});

router.get('/email/:templateId', function (req, res, next) {
    var text = utils.loadEmailTemplate(req.app, req.params.templateId);
    
    res.render('template_email', {
        configPath: req.app.get('config_path'),
        templateId: req.params.templateId,
        emailTemplate: text
    });
});

router.post('/email/:templateId', function (req, res, next) {
    var redirect = req.body.redirect;
    var body = utils.jsonifyBody(req.body);

    utils.saveEmailTemplate(req.app, req.params.templateId, body.emailTemplate);

    res.redirect(redirect);
});

module.exports = router;