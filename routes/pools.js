'use strict';

var express = require('express');
var router = express.Router();

var utils = require('./utils');

router.get('/', function (req, res, next) {
    const pools = utils.loadPools(req.app);

    const viewModel = {
        configPath: req.app.get('config_path'),
        pools: pools,
    };

    res.render('pools', viewModel);
});

router.post('/api', function (req, res, next) {
    const body = utils.getJson(req.body);
    utils.savePools(req.app, body.pools);
    res.status(200).json({ message: 'OK' });
});

module.exports = router;
