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
  
  // get new index
  self.db.incr('user.next.id', function (err, newId) {
    console.log ('+Redisd ---','ID for new user is:',newId);
    // hash password
    var hashedPwd = self.options.passwordCrypto(dataToStore.password);
  
    // set fields -- using MULTI feature
    self.db.multi()
      .set('user:' + dataToStore.username + ':id', newId)
      .set('user:' + newId + ':username', dataToStore.username)
      .set('user:' + newId + ':password', hashedPwd)
      .set('user:' + newId + ':type', 'user')
      .set('user:' + newId + ':role', 'user_reg')
      .hmset('user:' + newId + ':profile','email',dataToStore.email, redis.print)
      .exec(fn)
  });
}

Redisd.prototype.query = function (dataToQuery,callback) { 
  var self = this;
  // look for username
  self.db.get('user:' + dataToQuery.username + ':id', function (err, correspondingId) {
    if (correspondingId) {
      // check password
      self.db.get('user:' + correspondingId + ':password', function (err, existingPassword) {
      
        // compare password hash
        if (existingPassword && crypto.createHash('sha256').update(dataToQuery.password).digest("hex") == existingPassword ) {
          callback(null,true);
        }
        else {
          console.log ('+Redisd ---','wrong password'); 
          callback(err);
        }
      });
    }
    else {
      console.log ('+Redisd ---','user does not exist'); 
      callback(err);
    }
  });
};

exports = module.exports = new Redisd();

