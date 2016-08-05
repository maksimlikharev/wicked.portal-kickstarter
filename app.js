'use strict';

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var apis = require('./routes/apis');
var auth = require('./routes/auth');
var content = require('./routes/content');
var design = require('./routes/design');
var email = require('./routes/email');
var groups = require('./routes/groups');
var ipconfig = require('./routes/ipconfig');
var plans = require('./routes/plans');
var recaptcha = require('./routes/recaptcha');
var ssl = require('./routes/ssl');
var chatbot = require('./routes/chatbot');
var swagger = require('./routes/swagger');
var apidesc = require('./routes/apidesc');
var users = require('./routes/users');
var editcontent = require('./routes/editcontent');
var templates = require('./routes/templates');
var envs = require('./routes/envs');
var shutdown = require('./routes/shutdown');

// API functions
var api = require('./routes/api');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Combined == Apache style logs
if (app.get('env') == 'development')
    app.use(logger('dev'));
else
    app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/js/marked', express.static(path.join(__dirname, 'node_modules/marked')));

app.use('/', routes);
app.use('/ipconfig', ipconfig);
app.use('/ssl', ssl);
app.use('/users', users);
app.use('/auth', auth);
app.use('/groups', groups);
app.use('/plans', plans);
app.use('/apis', apis);
app.use('/recaptcha', recaptcha);
app.use('/content', content);
app.use('/email', email);
app.use('/chatbot', chatbot);
app.use('/design', design);
app.use('/swagger', swagger);
app.use('/apidesc', apidesc);
app.use('/editcontent', editcontent);
app.use('/templates', templates);
app.use('/envs', envs);
app.use('/shutdown', shutdown);

app.use('/api', api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
