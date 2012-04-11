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
    passwordCrypto : function (password) {
      return crypto.createHash('sha256').update(password).digest("hex");
    }
  }
};

Couchd.prototype.init = function (theDb,options) {
  if (options)
    this.options = options;

  this.db = theDb || this.create (); 
};

Couchd.prototype.create = function () {
  // configure db
  var db = new(cradle.Connection)({
    cache: false,
    raw: false
  }).database('min_users');

  db.exists(function (err, exists) {
    if (err) {
      console.log('+Couchd ---','error',err,'\nCannot connect to database.','Exiting...');
      process.exit(1);
    } else if (exists) {
      console.log('+Couchd ---','database already exists.','Connecting...');
    } else {
      console.log('+Couchd ---','database does not exist.','It will be now created');
      db.create();
      /* populate design documents */
      /* users view */
      db.save('_design/' + this.options.designDoc, {
        //users
        users: {
          map:  function(doc) {
            if (doc.type && doc.type==='user')
              emit(doc.username, doc);
          }
        }
      });
    }
  });
  return db;
};

Couchd.prototype.store = function (dataToStore,callback) {
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
  var hashedPwd = this.options.passwordCrypto(dataToStore.password);
  dataToStore.password = hashedPwd;
  dataToStore.type = 'user';
  dataToStore.role = 'user_reg';

  this.db.save(dataToStore,fn);
};

Couchd.prototype._query = function (dataToQuery,callback,testPassword) { // callback == done
  console.dir(dataToQuery);
  var self = this;
  this.db.view(self.options.designDoc +'/'+self.options.userView, { key : dataToQuery.username },  function (err, doc) {   
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
      console.dir('+Couchd ---',err);
    }
    return callback(null,false);
  });
};

Couchd.prototype.verifyCredentials = function (dataToQuery,callback) {
  this._query(dataToQuery,callback,true);
};

Couchd.prototype.getUserProfile = function (dataToQuery,callback) { 
  this._query(dataToQuery,callback);
};

exports = module.exports = new Couchd();

