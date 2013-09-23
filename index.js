#!/usr/bin/env node

var program = require('commander'),
    packageJson = require('./package.json'),
    db = require('./database'),
    hansel = require('hansel'),
    gretel,
    seenDomains;

function list(value) {
    return value.split(',') || [];
}

program._name = packageJson.name;
program
    .version(packageJson.version)
    .option('-s, --startUris <uris>', 'Uri(s) to start crawling from', list)
    .option('-q, --queuePath [filePath]', 'File path to load / save queue from')
    .parse(process.argv);

if(!program.queuePath){
    program.queuePath = 'breadcrumbs.json';
}

function passToHansel(uris){
    hansel.getPageRank(uris, function(error, results) {
        if(error){
            console.log(error.stack || error);
        }

        console.log(results);
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
        seenDomains
        passToHansel(queueItem.host);
    });

    gretel.load(program.queuePath, function(error){
        if(error){
            return console.log(error.stack || error);
        }

        gretel.start();
    });
}

function loadDomains(callback){
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

loadDomains(function(error){
    if(error){
        console.log(error.stack || error);
        return process.exit(1);
    }

    setupGretel();
});
