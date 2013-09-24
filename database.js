module.exports = function(connectionString) {

    var config = {},
        dbObject = {},
        mongoose = require('mongoose'),
        db = mongoose.connection,
        domainSchema = mongoose.Schema({
                uri: String,
                pageRank: Number,
                isValid: { type: Boolean, 'default': false },
                isSafe: { type: Boolean, 'default': false },
                outputGenerated: { type: Boolean, 'default': false }
            });

    if(connectionString){
        config.mongooseConnection = connectionString;
    } else {
        config = require('./config.json');
    }

    db.on('error', function(error) {
        console.log(error.stack || error);
    });

    dbObject.Domain = mongoose.model('Domain', domainSchema);
    dbObject.connection = mongoose.connect(config.mongooseConnection);

    return dbObject;

};