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

Redisd.prototype.init = function (theDb,options) {
  var self = this;
  if (options) {
    Object.keys(options).forEach(function(elem){
      self.options[elem] = options[elem];
    });
  }
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

Redisd.prototype._createRecord = function(username,dataToStore) {
  // set fields -- using MULTI feature
  var multi = self.db.multi()

  if (dataToStore["profiles"]) {
    console.log ('+Redisd ---',dataToStore["profiles"][0]);
    dataToStore["profiles"].forEach( function (index) {
      // handle 
      var profile = dataToStore["profiles"][index];
      // parsing parameter object
      var provider = profile.provider;
      delete profile.provider;
      for (param in profile) {
        multi = multi.hset('user:' + username + ':' + provider, param, profile[param]);
      };
    });      
  }

  // hash password
  if (dataToStore.password){
    var hashedPwd = self.options.passwordCrypto(dataToStore.password);
    delete dataToStore.password;
    multi.hset('user:' + username, 'password', hashedPwd);
  }

  // parsing parameter object
  for (param in dataToStore) {
    if (param !== "profiles")
      multi = multi.hset('user:' + username, param, dataToStore[param]);
  }; 

  return multi.hset('user:' + username, 'id', newId)
    .hset('user:' + username, 'type', dataToStore.type || 'user')
    .hset('user:' + username, 'role',  dataToStore.role || 'user_reg'); 
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
  var storeUser = function() {
    self.db.incr('user.next.id', function (err, newId) {
      console.log ('+Redisd ---','ID for new user is:',newId);
        
      var username = dataToStore.username;
      // set fields -- using MULTI feature
      var multi = self._createRecord(username,dataToStore);
      multi.hset('user:' + username, 'id', newId)
            .exec(fn);
    });
  };

  // first of all --> check username
  this._query(dataToStore,function (err, user) {
    if (err || !user) // ok -> user not found 
      storeUser();
    else 
      callback({msg : "username already taken" });
  });
}

Redisd.prototype._generateUserRecord = function (username,callback) {
  var self = this;
  var params = ['username','email','token','tokenSecret','socialid','displayName','imageUrl'];
  var user = {};

  var fillProfile = function (params, callback){
    self.db.hget('user:' + username, params, function (err, value) {
      if (value)
        user[params] = value;

      // remove parameter
      params.shift();

      // all parameter parsed
      if (params.length == 0)
        callback(null, user);

      fillProfile(params,callback);
    });
  };
  fillProfile(params,callback);
};

Redisd.prototype._query = function (dataToQuery,callback,testPassword) {
  var self = this;
  // look for username
  var username = dataToQuery.username;

  self.db.hget('user:' + username, 'id', function (err, correspondingId) {
    if (correspondingId) {
      if (testPassword) { // check password
        self.db.hget('user:' + username, 'password', function (err, existingPassword) {
          // compare password hash
          if (existingPassword && crypto.createHash('sha256').update(dataToQuery.password).digest("hex") == existingPassword ) {
            self._generateUserRecord(username,callback);
          }
          else {
            console.log ('+Redisd ---','wrong password'); 
            callback(err);
          } 
        });
      }
      else
        self._generateUserRecord(username,callback);
    }
    else {
      console.log ('+Redisd ---','user does not exist'); 
      callback(err);
    }
  });
};

Redisd.prototype.updateUser = function (username,dataToUpdate,callback) {
  var self = this;
  this._query({username:username},function(err,user) {        
    if (err)
      throw "User not Found";

    if (dataToUpdate.oldPassword){
      // compare if old password is correct
      var currentPassword = user.password;
      if (!currentPassword || (crypto.createHash('sha256').update(dataToUpdate.oldPassword)).digest("hex") !== currentPassword ) {
         // wrong password
         callback({msg:"wrong password"});
      }
      // remove old password from fields
      delete dataToUpdate.oldPassword; 
    }

    // set fields -- using MULTI feature
    var multi = self._createRecord(username,dataToUpdate) 
    multi.hset('user:' + username, 'id', newId)
        .exec(callback);
  });
};

Redisd.prototype.verifyCredentials = function (dataToQuery,callback) {
  this._query.apply(this,[dataToQuery,callback,true]);
};

Redisd.prototype.getUserProfile = function (dataToQuery,callback) { 
  this._query.apply(this,[dataToQuery,callback]);
};

exports = module.exports = new Redisd();


