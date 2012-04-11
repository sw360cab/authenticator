var util = require('util')
  , crypto = require('crypto')
  , redis = require("redis");

function Redisd() {
  this.name = 'Redis';
  this.db;
  this.options = {
    passwordCrypto : function (password) {
      return crypto.createHash('sha256').update(password).digest("hex");
    }
  }
};

Redisd.prototype.init = function (theDb) {
  this.db = theDb || this.create ();
};

Redisd.prototype.create = function () {
  // configure db
  var db =  redis.createClient();

  db.on('ready', function() {
     console.log('+Redisd ---','Successfully Connected to db.');
  });
  db.on('error', function() {
     console.log('+Redisd ---','Cannot connect to database.','Exiting...');
     process.exit(1);
  });
  return db;
};


Redisd.prototype.store  = function (dataToStore,callback) {
  var self = this;
  var fn =  function (err, replies) {
    console.log ('+Redisd ---','MULTI got',replies.length,'replies');
    replies.forEach(function (reply, index) {
      console.log ('+Redisd ---','Reply',index,':',reply.toString());
    });
    callback(err,replies);
  };

  console.log ('+Redisd ---','store');
  console.dir(dataToStore);
  
  // get new index
  self.db.incr('user.next.id', function (err, newId) {
    console.log ('+Redisd ---','ID for new user is:',newId);
      
    // set fields -- using MULTI feature
    var multi = self.db.multi()
    multi.hset('user:' + username, 'id', newId);
    var username = dataToStore.username;

    if (dataToStore["profiles"]) {
      console.log ('+Redisd ---',dataToStore["profiles"][0]);
      dataToStore["profiles"].forEach( function (index) {
        // handle 
        var profile = dataToStore["profiles"][index];
        // parsing parameter object
        var provider = profile.provider;
        delete profile.provider;
        Object.keys(profile).forEach( function (param) {
          multi = multi.hset('user:' + username + ':' + provider, param, profile[param]);
        });
      });      
    }

    // hash password
    if (dataToStore.password){
      var hashedPwd = self.options.passwordCrypto(dataToStore.password);
      delete dataToStore.password;
      multi.hset('user:' + username, 'password', hashedPwd);
    }

    // parsing parameter object
    Object.keys(dataToStore).forEach( function (param) {
      if (param !== "profiles")
        multi = multi.hset('user:' + username, param, dataToStore[param]);
    }); 

    multi.hset('user:' + username, 'type', dataToStore.type || 'user')
      .hset('user:' + username, 'role',  dataToStore.role || 'user_reg')
      .exec(fn);
  });
}

Redisd.prototype._generateUserRecord = function (userId,callback) {
  var params = ['username','email','token','tokenSecret','socialid','displayName','imageUrl'];
  var user = {};

  var fillProfile = function (params, callback){
    self.db.get('user:' + userId + ':' + params, function (err, value) {
      if (err)
        callback(null, userProfile);
      else {
        user[params] = value;
        // remove parameter
        params.shift();
        fillProfile(params,callback);
      }
    });
  }(params,callback);
  // fillProfile(params,callback);
};

Redisd.prototype._query = function (dataToQuery,callback,testPassword) {
  var self = this;
  // look for username
  self.db.get('user:' + dataToQuery.username + ':id', function (err, correspondingId) {
    if (correspondingId) {
      if (testPassword) { // check password
        self.db.get('user:' + correspondingId + ':password', function (err, existingPassword) {
          // compare password hash
          if (existingPassword && crypto.createHash('sha256').update(dataToQuery.password).digest("hex") == existingPassword ) {
            self._generateUserRecord(correspondingId,callback);
          }
          else {
            console.log ('+Redisd ---','wrong password'); 
            callback(err);
          } 
        });
      }
      else
        self._generateUserRecord(correspondingId,callback);
    }
    else {
      console.log ('+Redisd ---','user does not exist'); 
      callback(err);
    }
  });
};

Redisd.prototype.verifyCredentials = function (dataToQuery,callback) {
  this._query(dataToQuery,callback,true);
};

Redisd.prototype.getUserProfile = function (dataToQuery,callback) { 
  this._query(dataToQuery,callback);
};

exports = module.exports = new Redisd();


