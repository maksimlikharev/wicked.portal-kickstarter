'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var mustache = require('mustache');
var execSync = require('child_process').execSync;
var envReader = require('portal-env');

var utils = function () { };

utils.makeError = function (statusCode, errorText) {
    var err = new Error(errorText);
    err.status = statusCode;
    return err;
};

utils.jsonifyBody = function (reqBody) {
    var body = {};
    for (var prop in reqBody) {
        applyProperty(body, prop, reqBody[prop]);
    }
    return body;
};

utils.createRandomId = function () {
    return crypto.randomBytes(20).toString('hex');
};

function applyProperty(to, propName, value) {
    var subPropNames = propName.split('.');
    var current = to;
    for (var i = 0; i < subPropNames.length; ++i) {
        var thisProp = subPropNames[i];
        var bracketPos = thisProp.indexOf('[');
        // Array case
        if (bracketPos >= 0) {
            var index = Number(thisProp.substring(bracketPos + 1, thisProp.length - 1));
            thisProp = thisProp.substring(0, bracketPos);
            if (!current.hasOwnProperty(thisProp))
                current[thisProp] = [];
            if (i != subPropNames.length - 1) {
                if (!current[thisProp][index])
                    current[thisProp][index] = {};
                current = current[thisProp][index];
            } else {
                //current[thisProp][index] = value;
                var str_array = value.split(','); 
                if(str_array.length>1){
                  for(var i = 0; i < str_array.length; i++) {
                     current[thisProp][index++] = str_array[i];
                  }
                } else {
                  current[thisProp][index] = value;
                }
            }
        } else {
            // Object case
            if (i != subPropNames.length - 1) {
                if (!current.hasOwnProperty(thisProp))
                    current[thisProp] = {};
                current = current[thisProp];
            } else {
                if ("on" != value)
                    current[thisProp] = value;
                else
                    current[thisProp] = true;
            }
        }
    }
}

utils.isString = function (ob) {
    if (ob instanceof String || typeof ob === "string")
        return true;
    return false;
};

function replaceVar(ob, propName, envVars) {
    var value = ob[propName];
    if (!value.startsWith('$'))
        return;
    var defaultEnv = envVars["default"];
    var envVar = value.substring(1);
    if (defaultEnv.hasOwnProperty(envVar)) {
        ob[propName] = defaultEnv[envVar].value;
        // Mark it as taken from env var
        ob[propName + '_'] = true;
        ob[propName + '__'] = defaultEnv[envVar].encrypted;
    } else {
        console.log('Env var "' + envVar + '" is used, but does not exist in env var dictionary.');
        ob[propName] = '';
        ob[propName + '_'] = true;
        ob[propName + '__'] = false; // Default to unencrypted
    }
}

function getStringValue(origValue, envVars) {
    if (!origValue.startsWith('$'))
        return origValue;
    let envVar = origValue.substring(1);
    let defaultEnv = envVars["default"];
    if (defaultEnv.hasOwnProperty(envVar))
        return defaultEnv[envVar].value;
    console.log('getStringValue("' + origValue + '", envVars): Env var is used, but does not exist in env var dictionary.');
    return '';
}

utils.mixinEnv = function (target, envVars) {
    for (var prop in target) {
        var value = target[prop];
        if (utils.isString(value)) {
            // Do our thing here
            replaceVar(target, prop, envVars);
        } else if (Array.isArray(value)) {
            // Well well
            for (var i = 0; i < value.length; ++i) {
                var arrayValue = value[i];
                if (utils.isString(arrayValue))
                    value[i] = getStringValue(arrayValue, envVars);
                else if (!arrayValue)
                    continue;
                else if (Array.isArray(arrayValue))
                    throw new Error('mixinEnv does not support nested arrays. Meh.');
                else
                    utils.mixinEnv(arrayValue, envVars); // Now we can assume an object and recurse
            }
        } else {
            // Assume object, recurse
            utils.mixinEnv(value, envVars);
        }
    }
};

function mixoutVar(prefix, ob, propName, envVars) {
    var value = ob[propName];
    if (!ob[propName + '_'])
        return;
    var envVarName = prefix + '_' + propName.toUpperCase();
    switch (propName) {
        case "apiUrl": envVarName = 'PORTAL_API_URL'; break;
        case "portalUrl": envVarName = 'PORTAL_PORTAL_URL'; break;
        case "kongAdapterUrl": envVarName = 'PORTAL_KONG_ADAPTER_URL'; break;
        case "kongAdminUrl": envVarName = 'PORTAL_KONG_ADMIN_URL'; break;
        case "mailerUrl": envVarName = 'PORTAL_MAILER_URL'; break;
        case "chatbotUrl": envVarName = 'PORTAL_CHATBOT_URL'; break;
        case "staticConfig": envVarName = 'PORTAL_API_STATIC_CONFIG'; break;
        case "dynamicConfig": envVarName = 'PORTAL_API_DYNAMIC_CONFIG'; break;
    }
    if (!envVars[envVarName])
        envVars[envVarName] = {};
    envVars[envVarName].value = value;
    var encrypt = ob[propName + '__'];
    envVars[envVarName].encrypted = encrypt;
    ob[propName] = '$' + envVarName;
    delete ob[propName + '_'];
    delete ob[propName + '__'];
}

function mixoutEnvInt(prefix, source, envVars) {
    for (var prop in source) {
        if (prop.endsWith('_'))
            continue;
        var value = source[prop];
        if (utils.isString(value)) {
            // Do our thing here
            mixoutVar(prefix, source, prop, envVars);
        } else if (Array.isArray(value)) {
            // Well well
            //console.log(value);
            for (var i = 0; i < value.length; ++i) {
                var arrayValue = value[i];
                //console.log(arrayValue);
                if (utils.isString(arrayValue)) {
                    // nop
                } else if (!arrayValue)
                    continue;
                else if (Array.isArray(arrayValue))
                    throw new Error('mixoutEnv does not support nested arrays. Meh.');
                else
                    mixoutEnvInt(prefix + '_' + prop.toUpperCase() + i, arrayValue, envVars); // Now we can assume an object and recurse
            }
        } else {
            // Assume object, recurse
            mixoutEnvInt(prefix + '_' + prop.toUpperCase(), value, envVars);
        }
    }
}

utils.mixoutEnv = function (source, envVars, prefix) {
    if (!prefix)
        mixoutEnvInt('PORTAL', source, envVars["default"]);
    else
        mixoutEnvInt(prefix, source, envVars["default"]);
};

function getBaseDir(app) {
    return app.get('base_path');
}

function getConfigDir(app) {
    return app.get('config_path');
}

function getConfigKey(app) {
    return app.get('config_key');
}

function getResDir() {
    return path.join(__dirname, 'res');
}

function getGlobalsFileName(app) {
    var configDir = getConfigDir(app);
    var globalsFileName = path.join(configDir, 'globals.json');
    return globalsFileName;
}

utils.loadGlobals = function (app) {
    var g = JSON.parse(fs.readFileSync(getGlobalsFileName(app), 'utf8'));
    if (!g.network)
        g.network = {};
    if (!g.network.apiUrl)
        g.network.apiUrl = '$PORTAL_API_URL';
    if (!g.network.portalUrl)
        g.network.portalUrl = '$PORTAL_PORTAL_URL';
    if (!g.network.kongAdapterUrl)
        g.network.kongAdapterUrl = '$PORTAL_KONG_ADAPTER_URL';
    if (!g.network.kongAdminUrl)
        g.network.kongAdminUrl = '$PORTAL_KONG_ADMIN_URL';
    if (!g.network.mailerUrl)
        g.network.mailerUrl = '$PORTAL_MAILER_URL';
    if (!g.network.chatbotUrl)
        g.network.chatbotUrl = '$PORTAL_CHATBOT_URL';
    if (!g.db)
        g.db = {};
    if (!g.db.staticConfig)
        g.db.staticConfig = '$PORTAL_API_STATIC_CONFIG';
    if (!g.db.dynamicConfig)
        g.db.dynamicConfig = '$PORTAL_API_DYNAMIC_CONFIG';
    return g;
};

utils.saveGlobals = function (app, glob) {
    fs.writeFileSync(getGlobalsFileName(app), JSON.stringify(glob, null, 2), 'utf8');
};

/*
utils.loadEnv = function (app) {
    //return JSON.parse(fs.readFileSync(app.get('env_file'), 'utf8'));
    var envFile = fs.readFileSync(app.get('env_file'), 'utf8');
    var lines = envFile.replace(/\r/g, '').split('\n');
    var env = {};
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        if (!line)
            continue;
        var eq = line.indexOf('=');
        var envVar = line.substring(0, eq);
        var rest = line.substring(eq + 1).trim();
        if (rest.startsWith('$'))
            rest = rest.substring(1);
        if (rest.startsWith('"') || rest.startsWith("'"))
            rest = rest.substring(1, rest.length - 1);
        env[envVar] = unescape(rest);
    }
    return env;
}

utils.saveEnv = function (app, envVars) {
    console.log('env_file: ' + app.get('env_file'));
    //fs.writeFileSync(app.get('env_file') + '.json', JSON.stringify(envVars, null, 2), 'utf8');

    writeEnvFile(app.get('env_file'), envVars);
}
*/

utils.jsonClone = function (ob) {
    return JSON.parse(JSON.stringify(ob));
};

var BUILTIN_ENVVARS = {
    'LOCAL_IP': true,
    'LOCAL_API_HOST': true,
    'LOCAL_PORTAL_HOST': true,
    'LOCAL_PORTAL_URL': true,
    'LOCAL_API_URL': true
};

utils.loadEnvDict = function (app, usedEnvVars) {
    let kickstarter = utils.loadKickstarter(app);
    const envDict = {};
    if (!kickstarter.envs) {
        kickstarter.envs = ["default"];
        utils.saveKickstarter(app, kickstarter);
    }
    for (let i = 0; i < kickstarter.envs.length; ++i) {
        let envName = kickstarter.envs[i];
        let envFileName = path.join(getConfigDir(app), 'env', envName + '.json');
        if (!fs.existsSync(envFileName))
            throw new Error('loadEnvDict(): File not found: ' + envFileName);
        envDict[envName] = JSON.parse(fs.readFileSync(envFileName, 'utf8'));
    }
    decryptEnvDict(app, envDict);
    var defaultEnv = envDict["default"];

    if (usedEnvVars) {
        // Check if we have used env vars which are not yet in the
        // default environment dictionary.
        for (let propName in usedEnvVars) {
            if (BUILTIN_ENVVARS.hasOwnProperty(propName))
                continue;
            if (!defaultEnv.hasOwnProperty(propName)) {
                console.log('Picked up new env var ' + propName);
                defaultEnv[propName] = {
                    encrypted: false,
                    value: 'new property\nedit value'
                };
            }
        }
    }

    if (kickstarter.envs.length > 1) {
        // Propagate env vars from override files back to default env. If you haven't
        // manually edited the env files, this should never happen, but we do it in
        // case somebody has done just that.
        for (let envName in envDict) {
            if (envName == 'default')
                continue;
            let env = envDict[envName];
            for (let propName in env) {
                if (!defaultEnv[propName])
                    defaultEnv[propName] = utils.jsonClone(env[propName]);
            }
        }
        // Propagate default env vars back to all other envs and mark those
        // which come from "default" as inherited.
        for (let envName in envDict) {
            if (envName == 'default')
                continue;
            let env = envDict[envName];
            for (let propName in defaultEnv) {
                if (!env[propName]) {
                    env[propName] = utils.jsonClone(defaultEnv[propName]);
                    env[propName].inherited = true;
                }
            }
        }
    }

    // Now sort all the names; I know, this is actually not really defined,
    // but it works anyhow. Node.js handles the properties in the order they
    // were inserted.
    const propNames = [];
    for (let propName in defaultEnv)
        propNames.push(propName);
    propNames.sort();
    var tempDict = {};

    // Reinsert all the properties for all envs in the right order.
    for (let envName in envDict) {
        tempDict[envName] = {};
        for (let i = 0; i < propNames.length; ++i) {
            let propName = propNames[i];
            tempDict[envName][propName] = envDict[envName][propName];
        }
    }
    return tempDict;
};

function decryptEnvDict(app, envDict) {
    for (var envName in envDict) {
        var env = envDict[envName];
        for (var propName in env) {
            var prop = env[propName];
            if (prop.encrypted)
                prop.value = envReader.Crypt.apiDecrypt(getConfigKey(app), prop.value);
        }
    }
}

utils.saveEnvDict = function (app, envDict, envName) {
    var env = envDict[envName];
    cleanupEnv(env);
    encryptEnv(app, env);
    var envFileName = path.join(getConfigDir(app), 'env', envName + '.json');
    fs.writeFileSync(envFileName, JSON.stringify(env, null, 2), 'utf8');
};

function cleanupEnv(env) {
    // Clean up inherited values
    for (var propName in env) {
        var prop = env[propName];
        if (prop && prop.inherited)
            delete env[propName];
    }
}

function encryptEnv(app, env) {
    for (var propName in env) {
        var prop = env[propName];
        if (prop.encrypted)
            prop.value = envReader.Crypt.apiEncrypt(getConfigKey(app), prop.value);
    }
}

utils.deleteEnv = function (app, envId) {
    var envFileName = path.join(getConfigDir(app), 'env', envId + '.json');
    if (fs.existsSync(envFileName))
        fs.unlinkSync(envFileName);
};

utils.createEnv = function (app, newEnvId) {
    let envFileName = path.join(getConfigDir(app), 'env', newEnvId + '.json');
    let envDict = {};
    if (newEnvId === "localhost") {
        envDict = {
            PORTAL_CONFIG_BASE: { value: '/override/this/' },
            PORTAL_API_URL: { value: 'http://${LOCAL_IP}:3001' },
            PORTAL_CHATBOT_URL: { value: 'http://${LOCAL_IP}:3004' },
            PORTAL_KONG_ADAPTER_URL: { value: 'http://${LOCAL_IP}:3002' },
            PORTAL_KONG_ADMIN_URL: { value: 'http://${LOCAL_IP}:8001' },
            PORTAL_MAILER_URL: { value: 'http://${LOCAL_IP}:3003' },
            PORTAL_NETWORK_APIHOST: { value: '${LOCAL_IP}:8000' },
            PORTAL_NETWORK_PORTALHOST: { value: '${LOCAL_IP}:3000' },
            PORTAL_NETWORK_SCHEMA: { value: 'http' },
            PORTAL_PORTAL_URL: { value: 'http://${LOCAL_IP}:3000' }
        };
    }
    fs.writeFileSync(envFileName, JSON.stringify(envDict, null, 2), 'utf8');
};

/*
function writeEnvFile(envFileName, envVars) {
    var envString = '';
    for (var name in envVars) {
        envString += name + "=$'";
        envString += escape(envVars[name]) + "'\n";
    }
    fs.writeFileSync(envFileName, envString, 'utf8');
}
*/

function escape(s) {
    if (!s)
        return '';
    return s.replace(/[\\'"]/g, "\\$&").replace(/\r/g, '').replace(/\n/g, '\\n');
}

function unescape(s) {
    if (!s)
        return '';
    return s.replace(/\\n/g, '\r\n').replace(/\\[\\'"]/g, '$&');
}

function getPlansFileName(app) {
    var configDir = getConfigDir(app);
    var plansDir = path.join(configDir, 'plans');
    var plansFile = path.join(plansDir, 'plans.json');
    return plansFile;
}

utils.loadPlans = function (app) {
    return JSON.parse(fs.readFileSync(getPlansFileName(app)));
};

utils.savePlans = function (app, plans) {
    fs.writeFileSync(getPlansFileName(app), JSON.stringify(plans, null, 2), 'utf8');
};

function getGroupsFileName(app) {
    var configDir = getConfigDir(app);
    var groupsDir = path.join(configDir, 'groups');
    var groupsFile = path.join(groupsDir, 'groups.json');
    return groupsFile;
}

utils.loadGroups = function (app) {
    return JSON.parse(fs.readFileSync(getGroupsFileName(app), 'utf8'));
};

utils.saveGroups = function (app, groups) {
    fs.writeFileSync(getGroupsFileName(app), JSON.stringify(groups, null, 2), 'utf8');
};

function getApisFileName(app) {
    var configDir = getConfigDir(app);
    var apisDir = path.join(configDir, 'apis');
    var apisFileName = path.join(apisDir, 'apis.json');
    return apisFileName;
}

utils.loadApis = function (app) {
    const apis = JSON.parse(fs.readFileSync(getApisFileName(app), 'utf8'));
    const authServers = utils.getAuthServers(app);
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        if (thisApi.settings && thisApi.settings.scopes && Array.isArray(thisApi.settings.scopes)) {
            thisApi.settings.scopes = thisApi.settings.scopes.join(' ');
        } else if (thisApi.settings) {
            thisApi.settings.scopes = '';
        }
        // Fubble some defaults.
        if (!thisApi.settings) {
            thisApi.settings = {
                token_expiration: 3600,
                scopes: '',
                mandatory_scope: false
            };
        }
//        if (!thisApi.authServers && authServers.length > 0) {
//            thisApi.authServer = authServers[0];
//        }
    }
    return apis;
};

utils.saveApis = function (app, apis) {
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        if (thisApi.auth == 'oauth2') {
            if (thisApi.settings && thisApi.settings.scopes && utils.isString(thisApi.settings.scopes)) {
                const scopesString = thisApi.settings.scopes.trim();
                if (scopesString && scopesString !== '')
                    thisApi.settings.scopes = scopesString.split(' ');
                else
                    thisApi.settings.scopes = [];
            }
        } else if (thisApi.auth == 'key-auth') {
            if (thisApi.hasOwnProperty('settings'))
                delete thisApi.settings;
            if (thisApi.hasOwnProperty('authServers'))
                delete thisApi.authServer;
        }

    }
    fs.writeFileSync(getApisFileName(app), JSON.stringify(apis, null, 2), 'utf8');
};

function getApiDir(app, apiId) {
    var configDir = getConfigDir(app);
    var apisDir = path.join(configDir, 'apis');
    var apiDir = path.join(apisDir, apiId);
    return apiDir;
}

utils.prepareNewApi = function (app, apiId) {
    var apiDir = getApiDir(app, apiId);
    if (!fs.existsSync(apiDir))
        fs.mkdirSync(apiDir);
    else {
        console.log("utils.prepareNewApi: API already exists.");
        return;
    }
    var apiConfig = {
        api: {
            upstream_url: "http://your.new.api/",
            name: apiId,
            uris: "/" + apiId
        },
        plugins: []
    };
    var apiSwagger = {
        swagger: "2.0",
        info: {
            title: apiId,
            version: "1.0.0"
        },
        paths: {
            "/newapi": {
                get: {
                    responses: {
                        "200": {
                            description: "Success"
                        }
                    }
                }
            }
        }
    };
    utils.saveApiConfig(app, apiId, apiConfig);
    utils.saveSwagger(app, apiId, apiSwagger);
    utils.saveApiDesc(app, apiId, 'Your **new** API. Describe it here.');
};

utils.removeApiDir = function (app, apiId) {
    var apiDir = getApiDir(app, apiId);
    if (!fs.existsSync(apiDir))
        return; // ?
    var configFile = path.join(apiDir, 'config.json');
    var swaggerFile = path.join(apiDir, 'swagger.json');
    var descFile = path.join(apiDir, 'desc.md');

    if (fs.existsSync(configFile))
        fs.unlinkSync(configFile);
    if (fs.existsSync(swaggerFile))
        fs.unlinkSync(swaggerFile);
    if (fs.existsSync(descFile))
        fs.unlinkSync(descFile);
    fs.rmdirSync(apiDir);
};

function getSwaggerFileName(app, apiId) {
    var apiDir = getApiDir(app, apiId);
    var swaggerFileName = path.join(apiDir, 'swagger.json');
    return swaggerFileName;
}

utils.loadSwagger = function (app, apiId) {
    console.log('apiId: ' + apiId);
    return JSON.parse(fs.readFileSync(getSwaggerFileName(app, apiId), 'utf8'));
};

utils.saveSwagger = function (app, apiId, swagger) {
    fs.writeFileSync(getSwaggerFileName(app, apiId), JSON.stringify(swagger, null, 2), 'utf8');
};

utils.loadApiDesc = function (app, apiId) {
    var apiDir = getApiDir(app, apiId);
    var apiDescFile = path.join(apiDir, 'desc.md');
    if (!fs.existsSync(apiDescFile))
        return '';
    return fs.readFileSync(apiDescFile, 'utf8');
};

utils.saveApiDesc = function (app, apiId, markdown) {
    var apiDir = getApiDir(app, apiId);
    var apiDescFile = path.join(apiDir, 'desc.md');
    fs.writeFileSync(apiDescFile, markdown, 'utf8');
};

utils.loadApiConfig = function (app, apiId) {
    var apiDir = getApiDir(app, apiId);
    var configFileName = path.join(apiDir, 'config.json');
    return JSON.parse(fs.readFileSync(configFileName, 'utf8'));
};

utils.saveApiConfig = function (app, apiId, config) {
    var apiDir = getApiDir(app, apiId);
    var configFileName = path.join(apiDir, 'config.json');
    fs.writeFileSync(configFileName, JSON.stringify(config, null, 2), 'utf8');
};

function getContentDir(app) {
    var configDir = getConfigDir(app);
    return path.join(configDir, 'content');
}

function getCssFileName(app) {
    var contentDir = getContentDir(app);
    return path.join(contentDir, 'wicked.css');
}

utils.loadCss = function (app) {
    return fs.readFileSync(getCssFileName(app), 'utf8');
};

utils.saveCss = function (app, css) {
    fs.writeFileSync(getCssFileName(app), css, 'utf8');
};

utils.isPublic = function (uriName) {
    return uriName.endsWith('jpg') ||
        uriName.endsWith('jpeg') ||
        uriName.endsWith('png') ||
        uriName.endsWith('gif') ||
        uriName.endsWith('css');
};

utils.isContent = function (uriName) {
    return uriName.endsWith('.md') ||
        uriName.endsWith('.jade');
};

utils.getContentType = function (uriName) {
    if (uriName.endsWith('jpg') ||
        uriName.endsWith('jpeg'))
        return "image/jpeg";
    if (uriName.endsWith('png'))
        return "image/png";
    if (uriName.endsWith('gif'))
        return "image/gif";
    if (uriName.endsWith('css'))
        return "text/css";
    return "text/markdown";
};

utils.getContentFileName = function (app, pathUri) {
    var contentDir = getContentDir(app);
    if (pathUri.startsWith('/content/'))
        pathUri = pathUri.substring(9);
    return path.join(contentDir, pathUri);
};

utils.getContentIndexFileName = function (app) {
    var configDir = getConfigDir(app);
    return path.join(configDir, 'index');
};

function getContentItem(file, fileName, fullPath, pathUri) {
    if (file.endsWith('.md')) {
        let pathUriTemp = pathUri.substring(0, pathUri.length - 3); // cut .md
        return {
            path: pathUriTemp,
            localPath: fullPath,
            type: 'markdown'
        };
    } else if (file.endsWith('.jade')) {
        let pathUriTemp = pathUri.substring(0, pathUri.length - 5); // cut .jade
        return {
            path: pathUriTemp,
            localPath: fullPath,
            type: 'jade'
        };
    }
    throw Error("wtf?");
}

function getContentFileNamesRecursive(app, baseDir, dir, pathUris, publicUris) {
    var forDir = baseDir;
    if (dir)
        forDir = path.join(forDir, dir);
    var fileNames = fs.readdirSync(forDir).sort();

    //console.log(fileNames);

    // Files first
    var dirNames = [];
    for (let i = 0; i < fileNames.length; ++i) {
        var file = path.join(forDir, fileNames[i]);
        var fullPath = path.resolve(baseDir, file);
        var stat = fs.statSync(file);
        if (stat.isDirectory())
            dirNames.push(fileNames[i]);
        if (stat.isFile()) {
            var pathUriTemp = dir + '/' + fileNames[i];
            if (utils.isContent(file)) {
                pathUris.push(getContentItem(file, fileNames[i], fullPath, pathUriTemp));
            } else if (utils.isPublic(file)) {
                publicUris.push(dir + '/' + fileNames[i]);
            }
        }
    }
    for (let i = 0; i < dirNames.length; ++i) {
        var subDir = '/' + dirNames[i];
        if (dir)
            subDir = dir + subDir;
        getContentFileNamesRecursive(app, baseDir, subDir, pathUris, publicUris);
    }
}

utils.getContentFileNames = function (app) {
    var pathUris = [];
    var publicUris = [];
    var contentDir = getContentDir(app);
    getContentFileNamesRecursive(app, contentDir, '', pathUris, publicUris);
    return {
        pathUris: pathUris,
        publicUris: publicUris
    };
};

utils.createNewContent = function (app, newContent, contentType, callback) {
    var contentDir = getContentDir(app);
    var currentDir = contentDir;
    var fileParts = newContent.split('/');
    for (var i = 0; i < fileParts.length - 1; ++i) {
        currentDir = path.join(currentDir, fileParts[i]);
        fs.mkdirSync(currentDir);
    }
    var fileBase = path.join(currentDir, fileParts[fileParts.length - 1]);
    var contentFile;
    if (contentType == 'markdown')
        contentFile = fileBase + '.md';
    else // jade
        contentFile = fileBase + '.jade';
    var jsonFile = fileBase + '.json';

    if (fs.existsSync(contentFile))
        return callback(utils.makeError(409, 'Conrtent file ' + contentFile + ' already exists.'));
    if (fs.existsSync(jsonFile))
        return callback(utils.makeError(409, 'JSON config file ' + jsonFile + ' already exists.'));

    if (contentType == 'markdown')
        fs.writeFileSync(contentFile, '# Markdown Content', 'utf8');
    else
        fs.writeFileSync(contentFile, 'h1 Jade Content\r\n\r\np This is a paragraph.', 'utf8');
    var jsonConfig = {
        title: 'New Content',
        subTitle: 'Edit the file with whatever editor you like, then change the settings using the Preview here.',
        showTitle: true,
        omitContainer: false
    };
    fs.writeFileSync(jsonFile, JSON.stringify(jsonConfig, null, 2), 'utf8');

    callback();
};

utils.getInitialConfigDir = function () {
    var appDir = path.join(__dirname, '..', 'node_modules', 'portal-env');
    return path.join(appDir, 'initial-config');
};

utils.getInitialStaticConfigDir = function () {
    return path.join(utils.getInitialConfigDir(), 'static');
};

function getTemplatesDir(app) {
    var configDir = getConfigDir(app);
    var templatesDir = path.join(configDir, 'templates');
    return templatesDir;
}

function getChatbotTemplatesFile(app) {
    return path.join(getTemplatesDir(app), 'chatbot.json');
}

utils.loadChatbotTemplates = function (app) {
    return JSON.parse(fs.readFileSync(getChatbotTemplatesFile(app), 'utf8'));
};

utils.saveChatbotTemplates = function (app, templates) {
    fs.writeFileSync(getChatbotTemplatesFile(app), JSON.stringify(templates, null, 2), 'utf8');
};

utils.loadEmailTemplate = function (app, templateId) {
    var templatesDir = getTemplatesDir(app);
    var fileName = path.join(templatesDir, 'email', templateId + '.mustache');
    if (!fs.existsSync(fileName)) {
        var err = new Error('File not found: ' + fileName);
        err.status = 404;
        throw err;
    }
    return fs.readFileSync(fileName, 'utf8');
};

utils.saveEmailTemplate = function (app, templateId, templateText) {
    var templatesDir = getTemplatesDir(app);
    var fileName = path.join(templatesDir, 'email', templateId + '.mustache');
    fs.writeFileSync(fileName, templateText, 'utf8');
};

utils.loadKickstarter = function (app) {
    var configDir = getConfigDir(app);
    var kickstarter = JSON.parse(fs.readFileSync(path.join(configDir, 'kickstarter.json'), 'utf8'));
    if (!kickstarter.hasOwnProperty("env"))
        kickstarter.env = 2;
    return kickstarter;
};

utils.saveKickstarter = function (app, kickstarter) {
    var configDir = getConfigDir(app);
    fs.writeFileSync(path.join(configDir, 'kickstarter.json'), JSON.stringify(kickstarter, null, 2), 'utf8');
};

// === DEPLOY / DOCKER

utils.readDockerComposeTemplate = function (app) {
    return fs.readFileSync(path.join(getResDir(), 'docker-compose.yml.template'), 'utf8');
};

utils.readDockerComposeFile = function (app) {
    var baseDir = getBaseDir(app);
    var composeFile = path.join(baseDir, 'docker-compose.yml');
    if (fs.existsSync(composeFile)) {
        return fs.readFileSync(composeFile, 'utf8');
    }
    return null;
};

utils.writeDockerComposeFile = function (app, composeFileContent) {
    var baseDir = getBaseDir(app);
    var composeFile = path.join(baseDir, 'docker-compose.yml');
    fs.writeFileSync(composeFile, composeFileContent, 'utf8');
};

utils.readDockerfileTemplate = function (app) {
    return fs.readFileSync(path.join(getResDir(), 'Dockerfile.template'), 'utf8');
};

utils.readDockerfile = function (app) {
    var configDir = getConfigDir(app);
    var dockerFile = path.join(configDir, 'Dockerfile');
    if (fs.existsSync(dockerFile)) {
        return fs.readFileSync(dockerFile, 'utf8');
    }
    return null;
};

utils.writeDockerfile = function (app, dockerFileContent) {
    var configDir = getConfigDir(app);
    var dockerFile = path.join(configDir, 'Dockerfile');
    fs.writeFileSync(dockerFile, dockerFileContent, 'utf8');
};

// ==== SSL / CERTIFICATES

function getCertsDir(app) {
    const baseDir = getBaseDir(app);
    const certsDir = path.join(baseDir, 'certs');
    return certsDir;
}

utils.hasCertsFolder = function (app) {
    return fs.existsSync(getCertsDir(app));
};

utils.createCerts = function (app, validDays) {
    const certsDir = getCertsDir(app);
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir);
    }
    const glob = utils.loadGlobals(app);
    const kick = utils.loadKickstarter(app);

    if (!kick.envs)
        throw 'kickstarter.json does not have an envs property.';
    let envDict = utils.loadEnvDict(app);
    for (let env in kick.envs) {
        let envName = kick.envs[env];
        if (envName === 'localhost') // Don't do it for localhost
            continue;
        utils.createCert(app, glob, envDict, certsDir, envName, validDays);
    }
};

utils.createCert = function (app, glob, envDict, certsDir, envName, validDays) {
    const envDir = path.join(certsDir, envName);
    if (!fs.existsSync(envDir))
        fs.mkdirSync(envDir);
    let portalHost = resolveHostByEnv(envDict, envName, glob.network.portalHost.trim());
    let apiHost = resolveHostByEnv(envDict, envName, glob.network.apiHost.trim());
    let portalHostVarName = utils.resolveEnvVarName(glob.network.portalHost.trim(), 'PORTAL_NETWORK_PORTALHOST');
    let apiHostVarName = utils.resolveEnvVarName(glob.network.apiHost.trim(), 'PORTAL_NETWORK_APIHOST');

    let shTemplate = fs.readFileSync(path.join(getResDir(), 'env.sh.template'), 'utf8');
    let shContent = mustache.render(shTemplate, {
        envName: envName,
        portalHostVarName: portalHostVarName,
        portalHost: portalHost,
        apiHostVarName: apiHostVarName,
        apiHost: apiHost,
        portalConfigKey: getConfigKey(app)
    });
    let shFileName = path.join(certsDir, envName + '.sh');
    fs.writeFileSync(shFileName, shContent, 'utf8');
    fs.chmodSync(shFileName, '755');

    let openSslPortal = 'openssl req -x509 -nodes -days ' + validDays +
        ' -newkey rsa:2048 -keyout ' + envName + '/portal-key.pem' +
        ' -out ' + envName + '/portal-cert.pem' +
        ' -subj "/CN=' + portalHost + '"';
    let openSslApi = 'openssl req -x509 -nodes -days ' + validDays +
        ' -newkey rsa:2048 -keyout ' + envName + '/gateway-key.pem' +
        ' -out ' + envName + '/gateway-cert.pem' +
        ' -subj "/CN=' + apiHost + '"';

    let portalLogFile = path.join(certsDir, envName, 'portal-openssl.txt');
    let apiLogFile = path.join(certsDir, envName, 'gateway-openssl.txt');

    fs.writeFileSync(portalLogFile, openSslPortal, 'utf8');
    fs.writeFileSync(apiLogFile, openSslApi, 'utf8');

    let execOptions = {
        cwd: certsDir
    };

    execSync(openSslPortal, execOptions);
    execSync(openSslApi, execOptions);
};

utils.resolveEnvVarName = function (hostName, defaultName) {
    let envVarName;
    if (hostName.startsWith('${'))
        envVarName = hostName.substring(2, hostName.length - 1);
    else if (hostName.startsWith('$'))
        envVarName = hostName.substring(1);
    else
        return defaultName;
    return envVarName;
};

function resolveHostByEnv(envDict, envName, hostName) {
    if (!hostName.startsWith('$'))
        return hostName; // No env var here.
    let envVarName = utils.resolveEnvVarName(hostName);
    if (!envDict[envName])
        throw 'Unknown environment name: ' + envName;
    if (!envDict[envName][envVarName])
        throw 'Unknown env var used for host: ' + envVarName;
    return envDict[envName][envVarName].value;
}

function getAuthServerDir(app) {
    const configDir = getConfigDir(app);
    const authServerDir = path.join(configDir, 'auth-servers');
    if (!fs.existsSync(authServerDir))
        fs.mkdirSync(authServerDir);
    return authServerDir;
}

function isValidServerName(serverName) {
    return /^[a-z\-\_0-9]+$/.test(serverName);
}

utils.getAuthServers = function (app) {
    const authServerDir = getAuthServerDir(app);
    const fileNames = fs.readdirSync(authServerDir);
    const authServerNames = [];
    for (let i = 0; i < fileNames.length; ++i) {
        const fileName = fileNames[i];
        if (fileName.endsWith('.json')) {
            const strippedName = fileName.substring(0, fileName.length - 5);
            if (isValidServerName(strippedName))
                authServerNames.push(strippedName); // strip .json
        }
    }
    return authServerNames;
};

utils.loadAuthServer = function (app, serverName) {
    if (!isValidServerName(serverName))
        throw new Error('Server name ' + serverName + ' is not a valid auth server name (a-z, 0-9, -, _).');
    const authServerDir = getAuthServerDir(app);
    const fileName = path.join(authServerDir, serverName + '.json');
    if (!fs.existsSync(fileName))
        throw new Error('File not found: ' + fileName);
    return JSON.parse(fs.readFileSync(fileName, 'utf8'));
};

utils.saveAuthServer = function (app, serverName, serverInfo) {
    const authServerDir = getAuthServerDir(app);
    const fileName = path.join(authServerDir, serverName + '.json');
    fs.writeFileSync(fileName, JSON.stringify(serverInfo, null, 2), 'utf8');
};

utils.createAuthServer = function (app, serverName) {
    if (!isValidServerName(serverName))
        throw new Error('Server names must only contain a-z (lowercase), 0-9, - and _.');
    const authServerDir = getAuthServerDir(app);
    const fileName = path.join(authServerDir, serverName + '.json');
    if (fs.existsSync(fileName))
        throw new Error('File ' + fileName + ' already exists.');
    const serverInfo = {
        id: serverName,
        name: serverName,
        desc: 'Description of Authorization Server ' + serverName,
        url: "https://${PORTAL_NETWORK_APIHOST}/auth-server/{{apiId}}?client_id=(your app's client id)",
        config: {
            api: {
                name: serverName,
                upstream_url: 'http://auth-server:3005',
                uris: '/auth-server',
                preserve_host: false,
                strip_uri: false,
            },
            plugins: [
                {
                    name: 'correlation-id',
                    config: {
                        header_name: 'Correlation-Id',
                        generator: 'uuid',
                        echo_downstream: false
                    }
                }
            ]
        },
    };
    utils.saveAuthServer(app, serverName, serverInfo);
};

utils.makeSafeId = function (unsafeId) {
    return unsafeId.replace(/\-/g, '');
};

utils._packageVersion = null;
utils.getVersion = function () {
    if (!utils._packageVersion) {
        const packageFile = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packageFile)) {
            try {
                const packageInfo = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (packageInfo.version)
                    utils._packageVersion = packageInfo.version;
            } catch (ex) {
                console.error(ex);
            }
        }
        if (!utils._packageVersion) // something went wrong
            utils._packageVersion = "0.0.0";
    }
    return utils._packageVersion;
};

module.exports = utils;
