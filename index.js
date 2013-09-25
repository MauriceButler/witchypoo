#!/usr/bin/env node

var program = require('commander'),
    packageJson = require('./package.json'),
    witchypoo;


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

witchypoo = require('./witchypoo')(program);

try {
    witchypoo.loadDomains(function(error){
        if(error){
            witchypoo.exitProcessWithError(error);
        }

        witchypoo.loadWhiteLists(function(error){
            if(error){
                witchypoo.exitProcessWithError(error);
            }

            witchypoo.setupGretel();
        });
    });

} catch(exception) {
    witchypoo.exitProcessWithError(error);
}
