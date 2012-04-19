var couchdbNosqld = require('./couchdb-nosqld');
var redisNosqld = require('./redis-nosqld');

function Nosqld() {
  this.dbms = redisNosqld;
};

/*
 * Allow to configure which dbms will be used
 */
Nosqld.prototype.configure = function (dbms,dbName,db) {
  var options = dbName ? {"dbName" : dbName} : null;

  if (dbms === "couchd")
    this.dbms = couchdbNosqld;
  else if (dbms === "redisd")
    this.dbms = redisNosqld;
  // else fall back to default
  
  console.log('Nosqld will use ' + this.dbms.name); 
  
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

exports = module.exports = new Nosqld();

