var util = require('util')
  , crypto = require('crypto')
  , cradle = require('cradle');

function Couchd() {
  this.name = 'CouchDB';
  this.db;
  this.options = {
    dbName : 'min_users',
    designDoc : 'dataView',
    userView : 'users',
    alternativeView : 'usersByEmail',
    passwordCrypto : function (password) {
      return crypto.createHash('sha256').update(password).digest("hex");
    }
  }
};

Couchd.prototype.init = function (theDb,options) {
  var self = this;
  if (options) {
    Object.keys(options).forEach(function(elem){
      self.options[elem] = options[elem];
    });
  }
  this.db = theDb || this.create (); 
};

Couchd.prototype.create = function () {
  var self = this;
  // configure db
  var db = new(cradle.Connection)({
    cache: false,
    raw: false
  }).database(this.options.dbName);

  db.exists(function (err, exists) {
    if (err) {
      console.log('+Couchd ---','error',err,'\nCannot connect to database',self.options.dbName,'. Exiting...');
      process.exit(1);
    } else if (exists) {
      console.log('+Couchd ---','database',self.options.dbName,'already exists.','Connecting...');
    } else {
      if (self.options.ignoreCreation) {
        console.log('+Couchd ---','error',err,'\nCannot connect to database',self.options.dbName,'. Exiting...');
        process.exit(1);
      }
      console.log('+Couchd ---','database',self.options.dbName,'does not exist.','It will be now created');
      db.create( function (err, res) {
        if (err) {
          console.log('+Couchd ---','error',err,'\nCannot create database',self.options.dbName,'. Exiting...');
          process.exit(1);
        }
        /* populate design documents */
        /* users view */
        db.save('_design/' + self.options.designDoc, {
          //users
          users: {
            map:  function(doc) {
              if (doc.type && doc.type==='user')
                emit(doc.username, doc);
            }
          },
          usersByEmail: {
            map:  function(doc) {
              if (doc.type && doc.type==='user')
                emit(doc.email, doc);
            }
          }
        });
      });
    }
  });
  return db;
};

Couchd.prototype.store = function (dataToStore,callback) {
  var self = this;
  var fn =  function (err, resCouch) {
    if (err) {
      console.log('+Couchd ---','error',err);
    }
    else 
      console.log('+Couchd ---','couch result',JSON.stringify(resCouch))
    
    if (callback)
      callback(err,resCouch);
  };
  
  // handle & update password - hash
  if (dataToStore.password) {
    var hashedPwd = this.options.passwordCrypto(dataToStore.password);
    dataToStore.password = hashedPwd;
  }
  dataToStore.type = 'user';
  dataToStore.role = 'user_reg';
  
  // check username and email
  // TODO to be tested --> should work
  /*
  this._query(dataToStore,function (err,done) {
    if (err || !doc) { // ok -> user not found 
      // check email
      self._query({
      view : (self.options.designDoc +'/'+self.options.alternativeView),
        username : dataToStore.email,
      },
      function (err, doc) {
        if (err || !doc) // ok -> user not found 
          self.db.save(dataToStore,fn);
        else 
          callback({msg : "email already taken" });
      });
    }
    else
      callback({msg : "username already taken" });
  });
  */
  // check username
  this._query(dataToStore,function (err, doc) {
    if (err || !doc) // ok -> user not found 
      self.db.save(dataToStore,fn);
    else 
      callback({msg : "username already taken" });
  });
};

Couchd.prototype._query = function (dataToQuery,callback,testPassword) { // callback == done
  console.log('+Couchd ---','Data to query:', JSON.stringify(dataToQuery));
  var self = this;
  var view = dataToQuery.view ? dataToQuery.view : this.options.designDoc +'/'+this.options.userView;
  this.db.view(view, { key : dataToQuery.username },  function (err, doc) {   
    if (doc && doc.length == 1 ){
      console.log ('+Couchd ---','Found:',doc[0].value);      

      // check password
      if (testPassword) {
        if ( doc[0].value.password === self.options.passwordCrypto(dataToQuery.password) ) {
          user = {};
          user.username = doc[0].value.username;
          return callback(null,user);
        }
        else
          console.log ('+Couchd ---','wrong password');
      }
      else // just return user
        return callback(null,doc[0].value);
    }
    else {
      console.log('+Couchd ---',err ? JSON.stringify(err) : "empty document list returned" );
    }
    return callback(err,false);
  });
};

Couchd.prototype.updateUser = function (username,dataToUpdate,callback) {
  var self = this;
  this._query({username:username},function(err,doc) {
    if (err) {
      console.log("error",JSON.stringify(err) );
      throw "User not Found";
    }

    if (dataToUpdate.profiles) { // merge existing profiles with current
      var profiles = doc.profiles || [];
      for (index in profiles) { 
        if (profiles[index].provider == dataToUpdate.profiles[0].provider) // this should be replaced completely
          profiles.splice(index, 1);
      } 
      dataToUpdate.profiles = dataToUpdate.profiles.concat(profiles);
    }
  
    if (dataToUpdate.oldPassword){
      // compare if old password is correct
      var currentPassword = doc.password;
      if (!currentPassword || (crypto.createHash('sha256').update(dataToUpdate.oldPassword)).digest("hex") !== currentPassword ) {
         // wrong password
         callback({msg:"wrong password"});
      }
      // remove old password from fields
      delete dataToUpdate.oldPassword; 
    }

    self.db.merge (doc._id, dataToUpdate, function (err, success){
      success ? callback(null,true) : callback(true);
    });
  });
};

// attempt to autenticate with username then with email
Couchd.prototype.verifyCredentials = function (dataToQuery,callback) {
  var self = this;
  this._query(dataToQuery,function (err,done) {
    done ? callback(err,done) : 
    self._query({
      view : (self.options.designDoc +'/'+self.options.alternativeView),
      username : dataToQuery.username, // FIXME email:
      password : dataToQuery.password
    },callback,true);
  },true);
};

Couchd.prototype.getUserProfile = function (dataToQuery,callback) { 
  this._query(dataToQuery,callback);
};

exports = module.exports = new Couchd();
