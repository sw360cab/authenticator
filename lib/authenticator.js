var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , FacebookStrategy = require('passport-facebook').Strategy
  , TwitterStrategy = require('passport-twitter').Strategy
  ;

var nosqld = require('./nosqld/nosqld');

function Authenticator() {} ;

/*
 *options contains json for strategiest 
 *"strategy" : {
 *  name : name
 *  params : {}
 *}
 *
 *e.g. 
 *
 *twitter {
 *  consumerkey: consumerkey,
 *  consumersecret: consumersecret,
 *  callbackurl: callbackurl
 *}
 */
Authenticator.prototype.init = function (options) { 
  var self = this;
  // configure nosqld
  nosqld.configure();
  
  if (options && options){
    Object.keys(options).forEach(function (strategy) {        
        var params = options[strategy];
        var strategyMethodName = strategy.charAt(0).toUpperCase() + strategy.slice(1);
        
        console.log("In init",strategy);

        if ( ! ( params.consumerKey && params.secret && params.callbackURL && params.callbackStore && self['setUp'+ strategyMethodName]) )
          throw 'Authenticator --- Insufficient Number of Parameters to setup strategy: ' + strategy;

        // call setup method through reflection
        self['setUp'+ strategyMethodName](params.consumerKey,params.secret,params.callbackURL,params.callbackStore)
    });
  }

  // Passport session setup.
  //   To support persistent login sessions, Passport needs to be able to
  //   serialize users into and deserialize users out of the session.  Typically,
  //   this will be as simple as storing the user ID when serializing, and finding
  //   the user by ID when deserializing.  However, since this example does not
  //   have a database of user records, the complete Twitter profile is serialized
  //   and deserialized.
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(obj, done) {
    done(null, obj);
  });

  // define passport local strategy
  return passport.use(new LocalStrategy(
    function(username, password, done) { 
      var jsonData = {
        username : username,
        password : password
      };

      // validate login'Insufficient Number of Parameters';
      var validationResult = self.validateLogin(jsonData);

      // verify user existance
      if (validationResult.valid)       
         nosqld.verifyCredentials(jsonData,done);
      else 
        return done(null,false);
    }
  ));
}

Authenticator.prototype.oauthAuthCallback =  function(token, tokenSecret, profile, done, callbackStore, strategy) {
  // verify if account has changed
  var testAccountChanged = function (profiles,token) {
    var result = true;
    profiles.forEach ( function (index) {
      if (profiles[index].provider === strategy && profiles[index].token === token)
        result = false;
    });
    return result;
  };

  nosqld.getUserProfile (profile.username+'-'+strategy.toLowerCase(), function (err,user) {
    // profile does no exist or should be updated
    if (err || testAccountChanged () ) {
      nosqld.store ( callbackStore (token, tokenSecret, profile) , function (err, success){
        if (success) {
          console.log('Authenticator ---',strategy,'Account Stored');
        }
        else {
          console.log('Authenticator ---',strategy,'Account Fail while storing');
        }
      });
    }
  });

  // asynchronous verification, for effect...
  process.nextTick(function () {  
    return done(null, profile);
  });
}

Authenticator.prototype.setUpTwitter = function (consumerKey,consumerSecret,callbackURL,callbackStore) {
  console.log("In setup twitter");

  var self = this;
  // Use the FacebookStrategy within Passport.
  //   Strategies in passport require a `verify` function, which accept
  //   credentials (in this case, a token, tokenSecret, and Twitter profile), and
  //   invoke a callback with a user object.
  return passport.use(new TwitterStrategy({
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      callbackURL: callbackURL
    },
    function(token, tokenSecret, profile, done) {
      console.log("In callback twitter");

      return self.oauthAuthCallback(token, tokenSecret, profile, done, callbackStore,'Twitter'); 
    }
  ));
};

Authenticator.prototype.setUpFacebook = function (clientID,clientSecret,callbackURL,callbackStore) {
  // Use the TwitterStrategy within Passport.
  //   Strategies in passport require a `verify` function, which accept
  //   credentials (in this case, a token, tokenSecret, and Twitter profile), and
  //   invoke a callback with a user object.
  return passport.use(new FacebookStrategy({
      clientID: clientID,
      clientSecret: clientSecret,
      callbackURL: callbackURL
    },
    function(token, tokenSecret, profile, done) {'Insufficient Number of Parameters';
      self.oauthAuthCallback(token, tokenSecret, profile, done, callbackStore,'Facebook'); 
    }
    ));
};

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


Authenticator.prototype.login = function (req, res, strategy, callback) {
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
  var args = [req,res,callback];

  switch (strategy) {
    case "local":
      this.authenticateLocal.apply(this,args);
      break;
    case "twitter":
      this.authenticateTwitter.apply(this,args);
      break;
    case "facebook":
      this.authenticateFacebook.apply(this,args);
      break;
    default:
      this.authenticateLocal.apply(this,args);
  }
};


Authenticator.prototype.authenticateLocal = function (req, res, callback) {
  // If this function gets called, authentication was successful.
  // `req.user` property contains the authenticated user.
  passport.authenticate('local', callback)(req, res);
};

Authenticator.prototype.authenticateTwitter = function (req, res, callback) {
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  The first step in Twitter authentication will involve redirecting
  //   the user to twitter.com.  After authorization, the Twitter will redirect
  //   the user back to this application at /auth/twitter/callback
  passport.authenticate('twitter', callback)(req, res);
};

Authenticator.prototype.authenticateFacebook = function (req, res, callback) {
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  The first step in Twitter authentication will involve redirecting
  //   the user to facebook.com.  After authorization, the Twitter will redirect
  //   the user back to this application at /auth/facebook/callback
  passport.authenticate('facebook', { scope: ['user_status', 'user_checkins', 'publish_stream'] }, callback)(req, res);
};


Authenticator.prototype.logout = function(req, res){
  req.logout();
  res.redirect('/');
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

  // password confirmation verification
  if (queryJSON.password2) {
    if (!alphanum.test(queryJSON.password2) || queryJSON.password !== queryJSON.password2) {
      validationResult.reason = 'Password not verified';
      return validationResult;
    }
  }

  // check email  
  if (!emailRegExp.test(queryJSON.email)) {
    validationResult.reason = 'Email has invalid characters';
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
