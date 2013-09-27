module.exports = function (program) {

    var http = require('http'),
        https = require('https'),
        async = require('async'),
        hansel = require('hansel'),
        badwords = require('badwords/regexp'),
        seenDomains = {},
        whiteLists = {},
        gretel,
        db;

    db = require('./database')(program.connectionString);

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

    function isSubdomainOf(host, uri) {
        reversedHost = host.toLowerCase().split('').reverse().join('');
        reversedUri = uri.toLowerCase().split('').reverse().join('').substr(0, host.length);

        return reversedHost === reversedUri;
    }

    function isWhiteListDomain(host){
        var isWhiteListed = false;

        for (var i = 0; i < whiteLists.domains.length; i++) {
            if(isSubdomainOf(whiteLists.domains[i], host)){
                isWhiteListed = true;
                break;
            }
        }

        return isWhiteListed;
    }

    function isInvalidSubDomain(host){
        var isInvalid = false,
            keys = Object.keys(seenDomains);

        for (var i = 0; i < keys.length; i++) {
            if(isSubdomainOf(keys[i], host)){
                isInvalid =  true;
                break;
            }
        }

        return isInvalid;
    }

    function isWhiteListSubDomain(host){
        var isWhiteListed = false;

        for (var i = 0; i < whiteLists.subDomains.length; i++) {
            if(host.indexOf(whiteLists.subDomains[i]) === 0){
                isWhiteListed = true;
                break;
            }
        }

        return isWhiteListed;
    }

    function hasBeenSeen(queueItem){
        if(seenDomains[queueItem.host]){
            return true;
        }

        if(isWhiteListDomain(queueItem.host) || isWhiteListSubDomain(queueItem.host)){
            seenDomains[queueItem.host] = true;
            return false;
        }

        if(isInvalidSubDomain(queueItem.host)){
            seenDomains[queueItem.host] = true;
            return true;
        }

        seenDomains[queueItem.host] = true;
        return false;
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

    function validateDomain(queueItem, data, response){
        if(hasBeenSeen(queueItem)){
            return;
        }

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

        gretel.on('fetchcomplete', validateDomain);

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
                callback
            );
        });
    }

    function loadWhiteLists(callback){
        console.log( "Loading white lists..." );
        db.WhiteList.find({}, 'uri', function(error, lists){
            if(error){
                return callback(error);
            }

            async.map(
                lists,
                function(list, callback){
                    whiteLists[list.whiteListType] = list.whiteList;
                    callback();
                },
                callback
            );
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

    function exitProcessWithError(error){
        console.log(error.stack || error);

        if(gretel){
            gretel.save(program.queuePath);
        }

        console.log('EXITING PROCESS');
        return process.exit(1);
    }

    return {
        passToHansel: passToHansel,
        validateResponceLength: validateResponceLength,
        validateSafeness: validateSafeness,
        isSubdomainOf: isSubdomainOf,
        isWhiteListDomain: isWhiteListDomain,
        isWhiteListSubDomain: isWhiteListSubDomain,
        hasBeenSeen: hasBeenSeen,
        validateDomain: validateDomain,
        setupGretel: setupGretel,
        loadDomains: loadDomains,
        loadWhiteLists: loadWhiteLists,
        saveDomain: saveDomain,
        exitProcessWithError: exitProcessWithError
    };
};