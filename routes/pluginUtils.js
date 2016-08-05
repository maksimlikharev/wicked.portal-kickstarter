'use strict';

var pluginUtils = function () { };

pluginUtils.makeViewModel = function (configPlugins) {
    var foundRateLimiting = false;
    var foundCors = false;
    var foundFileLog = false;
    var foundCorrelationId = false;

    var plugins = {
        others: {
            useOthers: false,
            config: []
        }
    };

    for (var i = 0; i < configPlugins.length; ++i) {
        var plugin = configPlugins[i];
        if ("rate-limiting" == plugin.name) {
            plugins.rate_limiting = plugin;
            plugins.rate_limiting.useRateLimiting = true;
            foundRateLimiting = true;
        } else if ("cors" == plugin.name) {
            plugins.cors = plugin;
            plugins.cors.useCors = true;
            foundCors = true;
        } else if ("file-log" == plugin.name) {
            plugins.file_log = plugin;
            plugins.file_log.useFileLog = true;
            foundFileLog = true;
        } else if ("correlation-id" == plugin.name) {
            plugins.correlation_id = plugin;
            plugins.correlation_id.useCorrelationId = true;
            foundCorrelationId = true;
        } else {
            // Other plugin, here's room for extensions
            plugins.others.useOthers = true;
            plugins.others.config.push(plugin);
        }
    }

    if (!foundRateLimiting) {
        // Add a stub
        plugins.rate_limiting = {
            useRateLimiting: false,
            name: "rate-limiting",
            config: {
                hour: 100,
                async: true,
                continue_on_error: true
            }
        };
    }
    if (!foundCors) {
        // Add a stub for CORS
        plugins.cors = {
            useCors: false,
            name: "cors",
            config: {
                origin: '*',
                methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
            }
        };
    }

    if (!foundFileLog) {
        // Add a stub for FileLog
        plugins.file_log = {
            useFileLog: false,
            name: 'file-log',
            config: {
                path: '/usr/local/kong/logs/kong-access.log'
            }
        };
    }

    if (!foundCorrelationId) {
        // Add a stub for correlation id
        plugins.correlation_id = {
            useCorrelationId: false,
            name: 'correlation-id',
            config: {
                header_name: 'Correlation-Id',
                generator: 'uuid',
                echo_downstream: false
            }
        };
    }

    if (plugins.others.useOthers) {
        plugins.others.config = JSON.stringify(plugins.others.config, null, 2);
    } else {
        // We'll add a small stub here as well
        plugins.others.config = JSON.stringify([
            {
                name: "jwt",
                config: {
                    uri_param_names: 'jwt',
                    claims_to_verify: '...'
                }
            },
            {
                name: "...",
                config: {}
            }
        ],
            null, 2);
    }

    return plugins;
};

// Sanitize JSON format for Kong
function fixRateLimiting(data) {
    //console.log('fixRateLimiting: ' + JSON.stringify(data, null, 2));
    var rls = [
        "second",
        "minute",
        "hour",
        "day",
        "month",
        "year"
    ];
    for (var propIndex in rls) {
        var prop = rls[propIndex];
        if (data.config.hasOwnProperty(prop) && data.config[prop] !== "")
            data.config[prop] = Number(data.config[prop]);
        else if (data.config.hasOwnProperty(prop))
            delete data.config[prop];
    }
    return data;
}

// Sanitize JSON format for Kong
function fixCors(data) {
    //console.log('fixCors: ' + JSON.stringify(data, null, 2));
    if (data.config.hasOwnProperty('max_age') && data.config.max_age !== "")
        data.config.max_age = Number(data.config.max_age);
    else if (data.config.hasOwnProperty('max_age'))
        delete data.config.max_age;
    var props = [
        "origin",
        "methods",
        "headers",
        "exposed_headers"
    ];
    for (var propIndex in props) {
        var prop = props[propIndex];
        if (!(data.config.hasOwnProperty(prop) && data.config[prop] !== ""))
            delete data.config[prop];
    }
    return data;
}

pluginUtils.makePluginsArray = function (bodyPlugins) {
    //console.log(JSON.stringify(bodyPlugins, null, 2));
    var plugins = [];
    if (bodyPlugins.rate_limiting.useRateLimiting) {
        delete bodyPlugins.rate_limiting.useRateLimiting;
        bodyPlugins.rate_limiting.name = 'rate-limiting';
        plugins.push(fixRateLimiting(bodyPlugins.rate_limiting));
    }
    if (bodyPlugins.cors && bodyPlugins.cors.useCors) {
        delete bodyPlugins.cors.useCors;
        bodyPlugins.cors.name = 'cors';
        plugins.push(fixCors(bodyPlugins.cors));
    }
    if (bodyPlugins.file_log && bodyPlugins.file_log.useFileLog) {
        delete bodyPlugins.file_log.useFileLog;
        bodyPlugins.file_log.name = 'file-log';
        plugins.push(bodyPlugins.file_log);
    }
    if (bodyPlugins.correlation_id && bodyPlugins.correlation_id.useCorrelationId) {
        delete bodyPlugins.correlation_id.useCorrelationId;
        bodyPlugins.correlation_id.name = 'correlation-id';
        plugins.push(bodyPlugins.correlation_id);
    }
    if (bodyPlugins.others.useOthers) {
        var pluginsArray = JSON.parse(bodyPlugins.others.config);
        if (!Array.isArray(pluginsArray))
            throw new Error('The content of the "other plugins" text area must be a JSON array ([ ... ])!');
        for (var i = 0; i < pluginsArray.length; ++i) {
            var thisPlugin = pluginsArray[i];
            if (!thisPlugin.name)
                throw new Error('An item in the plugins array must always have a "name" property.');
            plugins.push(thisPlugin);
        }
    }
    return plugins;
};

module.exports = pluginUtils;