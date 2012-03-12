var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

var nosqld = require('./nosqld/nosqld');

function Authenticator() {} ;

Authenticator.prototype.init = function () { 
  var self = this;
  // configure nosqld
  nosqld.configure();
  
  // define passport strategy
  return passport.use(new LocalStrategy(
    function(username, password, done) { 
      var jsonData = {
        username : username,
        password : password
      };

      // validate login
      var validationResult = self.validateLogin(jsonData);

      // verify user existance
      if (validationResult.valid)       
         nosqld.query(jsonData,done);
      else 
        return done(null,false);
    }
  ));
}

// Authenticator.prototype.register = function (jsonData,res,callback,validator) 
Authenticator.prototype.register = function (req,res,callback,validator) {
  // TODO check
  var jsonData = req.body;
  // define custom validator or fallback
  var validationResult = validator ? validator(jsonData) : this.validate(jsonData);
  
  // define custom callback or fallback
  var callback = callback || function (err, success){
    if (success) {
      res.writeHead(200);      
      res.end("Registered\n");
    }
    else {
      var msg = err.msg ? err.msg : ('wrong request\n');
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(msg);
    }
  };

  // on validation success store on db
  if (validationResult.valid) {
    nosqld.store (jsonData,callback);
   }
  else {
    callback( {msg : validationResult.reason } );
  }
};

Authenticator.prototype.login = function (req, res, callback) {
  // define custom callback or fallback
  var callback = callback || function(err, user) {
    if (err) { console.dir(err); return next(err); }
    if (!user) {
      res.writeHead(401);
      res.end("Unauthorized\n");
      return;
    }
    // set username in session
    req.session.username = user.username; 
    res.writeHead(200);      
    res.end("Authenticated\n");
  };
  // If this function gets called, authentication was successful.
  // `req.user` property contains the authenticated user.
  passport.authenticate('local', callback)(req, res);
};

// dafeult registration validator
// should return JSON for error {field: resason}
Authenticator.prototype.validate = function(queryJSON) {
  var alphanum = /^[A-Za-z0-9_]*$/;
  var emailRegExp = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  var validationResult = {}; 
  validationResult.valid = false;

  if (! (queryJSON.username && queryJSON.password && queryJSON.email) ) {
    validationResult.reason = 'Insufficient Number of Parameters';
    return validationResult; 
  }

  // check username & pwd length
  if (queryJSON.username.length < 3) {
    validationResult.reason = 'Username is too short';
    return validationResult; 
  }
    
  if (queryJSON.password.length < 6) {
    validationResult.reason = 'Password is too short';
    return validationResult; 
  }
   
  // check username & pwd regexp --> alphanum
  if (!alphanum.test(queryJSON.username)){
    validationResult.reason = 'Username has invalid characters';
    return validationResult; 
  }
  
  if (!alphanum.test(queryJSON.password)) {
    validationResult.reason = 'Password has invalid characters';
    return validationResult; 
  }

  // check email  
  if (!emailRegExp.test(queryJSON.email)) {
    validationResult.reason = 'Password has invalid characters';
    return validationResult; 
  }
  
  validationResult.valid = true;
  return validationResult;
}

// dafeult login validator
// should return JSON for error {field: resason}
Authenticator.prototype.validateLogin = function(queryJSON) {
  var validationResult = {}; 
  validationResult.valid = false;
  
  if (! (queryJSON.username && queryJSON.password) ) {
    validationResult.reason = 'Insufficient Number of Parameters';
    return validationResult; 
  }
  validationResult.valid = true;
  return validationResult;
};

exports = module.exports = new Authenticator();
