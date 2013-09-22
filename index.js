#!/usr/bin/env node

var program = require('commander'),
    packageJson = require('./package.json'),
    hansel = require('hansel'),
    gretel;

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
        console.log( "Saving breadcrumbs for later..." );
        gretel.queue.freeze(program.queuePath, function(error){
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
        passToHansel(queueItem.host);
    });

    gretel.load(program.queuePath, function(error){
        if(error){
            return console.log(error.stack || error);
        }

        gretel.start();
    });
}

setupGretel();