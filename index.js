#!/usr/bin/env node

var program = require('commander'),
    packageJson = require('./package.json'),
    http = require('http'),
    https = require('https'),
    async = require('async'),
    hansel = require('hansel'),
    badwords = require('badwords/regexp'),
    seenDomains = {},
    gretel,
    db;

function list(value) {
    return value.split(',') || [];
}

program._name = packageJson.name;
program
    .version(packageJson.version)
    .option('-s, --startUris <uris>', 'Uri(s) to start crawling from', list)
    .option('-q, --queuePath [filePath]', 'File path to load / save queue from')
    .option('-d, --connectionString [connectionString]', 'Database connection string')
    .parse(process.argv);

if(!program.queuePath){
    program.queuePath = 'breadcrumbs.json';
}

function passToHansel(domainObject){
    hansel.getPageRank(domainObject.uri, function(error, results) {
        if(error){
            return console.log(error.stack || error);
        }
        domainObject.pageRank = results[0].pageRank;
        saveDomain(domainObject);
    });
}

function validateResponceLength(queueItem, response, callback){
    var client = queueItem.protocol === 'https' ? https : http;

    client.get(queueItem.protocol + '://' + queueItem.host, function(response) {
        response.on("data", function(chunk) {
            response.pause();
            response.destroy();
            callback(chunk.length > 100);
        });
    });
}

function validateSafeness(data, callback){
    var html = data.toString();
    callback(!html.match(badwords));
}

function validateDomain(queueItem, data, response){
    validateResponceLength(queueItem, response, function(isValid){
        validateSafeness(data, function(isSafe){
            passToHansel(
                {
                    uri: queueItem.host,
                    isValid: isValid,
                    isSafe: isSafe,
                    responeCode: response.statusCode
                }
            );
        });
    });
}

function setupGretel(){
    gretel = require('gretel')(program.startUris);

    process.on( 'SIGINT', function() {
        gretel.save(program.queuePath, function(error){
            if(error){
                console.log(error.stack || error);
                process.exit(1);
            }
            process.exit(0);
        });
    });

    gretel.on('complete ', function() {
        console.log( "All breadcrumbs have been followed..." );
    });

    gretel.on('fetchcomplete', function(queueItem, data, response) {
        if(!seenDomains[queueItem.host]){
            seenDomains[queueItem.host] = true;
            validateDomain(queueItem, data, response);
        }
    });

    gretel.load(program.queuePath, function(error){
        if(error){
            return console.log(error.stack || error);
        }

        gretel.start();
    });
}

function loadDomains(callback){
    db = require('./database')(program.connectionString);

    console.log( "Loading recorded domains..." );
    db.Domain.find({}, 'uri', function(error, domains){
        if(error){
            return callback(error);
        }

        async.map(
            domains,
            function(domain, callback){
                seenDomains[domain.uri] = true;
                callback();
            },
            callback);
    });
}

function saveDomain(domainObject){
    console.log(domainObject);
    db.Domain.update({uri: domainObject.uri}, domainObject, {upsert: true}, function(error){
        if(error){
            console.log(error.stack || error);
        }
    });
}

try {
    loadDomains(function(error){
        if(error){
            console.log(error.stack || error);
            console.log('EXITING PROCESS');
            return process.exit(1);
        }

        setupGretel();
    });

} catch(exception) {
    console.log(exception.stack || exception);
    gretel.save(program.queuePath);
    console.log('EXITING PROCESS');
    return process.exit(1);
}
