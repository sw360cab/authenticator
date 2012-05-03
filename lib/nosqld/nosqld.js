var couchdbNosqld = require('./couchdb-nosqld');
var redisNosqld = require('./redis-nosqld');

function Nosqld() {
  this.dbms = couchdbNosqld;
};

/*
 * Allow to configure which dbms will be used
 */
Nosqld.prototype.configure = function (dbms,options,db) {
  if (dbms === "couchd")
    this.dbms = couchdbNosqld;
  else if (dbms === "redisd")
    this.dbms = redisNosqld;
  // else fall back to default
  
  console.log('Nosqld will use ' + this.dbms.name); 
  
  // options may contain dbms and db info as well who should be ignored
  if (options && options.dbms) delete options.dbms;
  if (options && options.db) delete options.db;

  this.init(null, options);
}

Nosqld.prototype.init = function (theDb,options) {
  return this.dbms.init(theDb, options);
};

Nosqld.prototype.store  = function (dataToStore,callback) {
  return this.dbms.store(dataToStore,callback);
};

Nosqld.prototype._query = function (dataToQuery,callback,testPassword) { 
  return this.dbms._query(dataToQuery,callback,testPassword);
};

Nosqld.prototype.verifyCredentials = function (dataToQuery,callback) {
  return this.dbms.verifyCredentials(dataToQuery,callback);
};

Nosqld.prototype.getUserProfile = function (dataToQuery,callback) { 
  return this.dbms.getUserProfile(dataToQuery,callback);
};

Nosqld.prototype.updateUser = function (username,dataToUpdate,callback) {
  return this.dbms.updateUser(username,dataToUpdate,callback);
};

exports = module.exports = new Nosqld();

