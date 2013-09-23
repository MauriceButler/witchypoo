(function () {

    var config = require('./config.json'),
        lastModifiedPlugin = require('./lastModifiedPlugin'),
        dbObject = {},
        mongoose = require('mongoose'),
        db = mongoose.connection,
        domainSchema = mongoose.Schema({
                uri: String,
                pageRank: Number,
                outputGenerated: { type: Boolean, 'default': false }
            });


    domainSchema.plugin(lastModifiedPlugin, { index: true });

    db.on('error', function(error) {
        console.log(error.stack || error);
    });

    dbObject.Domain = mongoose.model('Domain', domainSchema);
    dbObject.connection = mongoose.connect(config.mongooseConnection);

    module.exports = dbObject;

}());