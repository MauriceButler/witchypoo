var test = require('tape'),
    mockery = require('mockery');

mockery.registerAllowables(['../witchypoo', 'badwords/regexp', 'async']);

mockery.registerMock('./database', function(){});
mockery.registerMock('http', {});
mockery.registerMock('https', {});
mockery.registerMock('hansel', {});
mockery.registerMock('gretel', {});

function getCleanTestObject(){
    mockery.enable({ useCleanCache: true, warnOnReplace: false });
    var witchypoo = require('../witchypoo')({});
    mockery.disable();
    return witchypoo;
}

test('witchypoo Exists', function (t) {
    var witchypoo = getCleanTestObject();
    t.plan(2);
    t.ok(witchypoo, 'witchypoo Exists');
    t.equal(typeof witchypoo, 'object', 'witchypoo is an object');
});

test('validateSafeness', function (t) {
    var witchypoo = getCleanTestObject();
    t.plan(4);
    t.ok(witchypoo.validateSafeness, 'witchypoo.validateSafeness Exists');
    t.equal(typeof witchypoo.validateSafeness, 'function', 'witchypoo.validateSafeness is a function');
    witchypoo.validateSafeness('shit is a bad word', function(result){
        t.notOk(result, 'fails on bad words');
    });
    witchypoo.validateSafeness('kitten is a good word', function(result){
        t.ok(result, 'succeeds on good words');
    });
});

test('isSubdomainOf', function (t) {
    var witchypoo = getCleanTestObject();
    t.plan(4);
    t.ok(witchypoo.isSubdomainOf, 'witchypoo.isSubdomainOf Exists');
    t.equal(typeof witchypoo.isSubdomainOf, 'function', 'witchypoo.isSubdomainOf is a function');
    t.ok(witchypoo.isSubdomainOf('foo.com', 'www.foo.com'), 'detects valid subdomains');
    t.notOk(witchypoo.isSubdomainOf('bar.com', 'www.foo.com'), 'detects invalid subdomains');
});

function setupWhiteLists(t){
    mockery.registerMock('./database', function(){ return {WhiteList: {find:function(query, fields, callback){
        callback(null,
            [
                {whiteListType: 'domains', whiteList: ['foo.com', 'bar.com']},
                {whiteListType: 'subDomains', whiteList: ['www', 'blog']}
            ]
        );
    }}};});
}

test('WhiteLists', function (t) {
    t.plan(13);

    setupWhiteLists();
    var witchypoo = getCleanTestObject();

    witchypoo.loadWhiteLists(function(){
        t.pass('whiteLists loaded');
    });

    t.ok(witchypoo.loadWhiteLists, 'witchypoo.loadWhiteLists Exists');
    t.equal(typeof witchypoo.loadWhiteLists, 'function', 'witchypoo.loadWhiteLists is a function');

    t.ok(witchypoo.isWhiteListDomain, 'witchypoo.isWhiteListDomain Exists');
    t.equal(typeof witchypoo.isWhiteListDomain, 'function', 'witchypoo.isWhiteListDomain is a function');

    t.notOk(witchypoo.isWhiteListDomain('google.com'), 'detects non white list domains');
    t.ok(witchypoo.isWhiteListDomain('foo.com'), 'detects white list domains');
    t.ok(witchypoo.isWhiteListDomain('majigger.foo.com'), 'detects white list domains with sub domain');


    t.ok(witchypoo.isWhiteListSubDomain, 'witchypoo.isWhiteListSubDomain Exists');
    t.equal(typeof witchypoo.isWhiteListSubDomain, 'function', 'witchypoo.isWhiteListSubDomain is a function');

    t.notOk(witchypoo.isWhiteListSubDomain('api.google.com'), 'detects non white list sub domains');
    t.ok(witchypoo.isWhiteListSubDomain('www.google.com'), 'detects white list sub domains');
    t.ok(witchypoo.isWhiteListSubDomain('blog.foo.bar.com'), 'detects white list sub domains with sub domain');

});

test('hasBeenSeen', function (t) {
    t.plan(9);

    setupWhiteLists();
    var witchypoo = getCleanTestObject();

    witchypoo.loadWhiteLists(function(){
        t.pass('whiteLists loaded');
    });

    t.ok(witchypoo.hasBeenSeen, 'witchypoo.hasBeenSeen Exists');
    t.equal(typeof witchypoo.hasBeenSeen, 'function', 'witchypoo.hasBeenSeen is a function');
    t.notOk(witchypoo.hasBeenSeen({host: 'google.com'}), 'handels never seen');
    t.ok(witchypoo.hasBeenSeen({host: 'api.google.com'}), 'handels non whiteList subdomain on seen');
    t.notOk(witchypoo.hasBeenSeen({host: 'www.google.com'}), 'handels whiteList subdomain on seen');
    t.notOk(witchypoo.hasBeenSeen({host: 'foo.com'}), 'handels new whitelist domain');
    t.notOk(witchypoo.hasBeenSeen({host: 'blog.foo.com'}), 'handels new whitelist subdomain on whitelist seen');
    t.notOk(witchypoo.hasBeenSeen({host: 'majigger.foo.com'}), 'handels new non whitelist subdomain on whitelist seen');
});




