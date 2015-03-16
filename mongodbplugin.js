var mongoose = require('mongoose');
var deasync = require('deasync');
var cryptoUtil = require('./js/util/crypto');

function get(db, keyValueModel, _key, callback)
{
    keyValueModel.find(
        {key: _key},
        function (err, data) {
            if (err)
                return callback(err, null);
            if (!data.length)
                return callback('notfound');
            callback(err, data[data.length - 1].value);
        }
    );
}

function set(db, keyValueModel, _key, _value, callback)
{
    var pair = {key: _key, value: _value};
    var kv = new keyValueModel(pair);
    {
        var f = function (err, numberAffected, rawResponse){
            if (err)
                console.log('Error on set: ' + err);
            if (callback)
                callback(err);
        };
        kv.update(
            pair,
            {upsert: true},
            f
        );
    }
}


function MongoDbPlugin(config) {
    var ready = false;
    this.db = mongoose.connect('mongodb://localhost/copay', {}, function(){ ready = true; });
    
    while (!ready)
        deasync.runLoopOnce();

    this.keyValueSchema = mongoose.Schema({ key: String, value: String });
    this.keyValueModel = mongoose.model('keyValue', this.keyValueSchema);
    this.type = 'DB';
}

MongoDbPlugin.prototype.init = function () {};

MongoDbPlugin.prototype.setCredentials = function(email, password, opts) {
    this.email = email;
    this.password = password;
};

MongoDbPlugin.prototype.createItem = function(name, value, callback) {
    var self = this;
    this.getItem(name, function(err, retrieved) {
        if (err || !retrieved)
            return self.setItem(name, value, callback);
        return callback('EEXISTS');
    });
};

MongoDbPlugin.prototype.getItem = function(name, callback) {
    var key = cryptoUtil.kdf(this.password + this.email);
    get(
        this.db,
        this.keyValueModel,
        name,
        function(err, result) {
            if (!err)
                callback(null, cryptoUtil.decrypt(key, result));
            else
                callback(err);
        }
    );
};

MongoDbPlugin.prototype.setItem = function(name, value, callback) {
    if (typeof value != 'string')
        value = JSON.stringify(value);
    var key = cryptoUtil.kdf(this.password + this.email);
    set(this.db, this.keyValueModel, name, cryptoUtil.encrypt(key, value), callback);
};

MongoDbPlugin.prototype.removeItem = function(name, callback) {
    this.setItem(name, '', callback);
};

MongoDbPlugin.prototype.clear = function(callback) {
    // NOOP
    callback();
};

MongoDbPlugin.prototype.allKeys = function(callback) {
    // TODO: compatibility with localStorage
    return callback(null);
};

MongoDbPlugin.prototype.getFirst = function(prefix, opts, callback) {
    // TODO: compatibility with localStorage
    return callback(null, true, true);
};

module.exports = MongoDbPlugin;
