var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , FacebookStrategy = require('passport-facebook').Strategy
  , TwitterStrategy = require('passport-twitter').Strategy
  , url = require('url')
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
  if (options && options.nosqld){
    // extract db and dbms options
    nosqld.configure(options.nosqld.dbms,options.nosqld);
    delete options.nosqld;
  } 
  else {
    nosqld.configure();
  }

  if (options && options){
    Object.keys(options).forEach(function (strategy) {        
        var params = options[strategy];
        var strategyMethodName = strategy.charAt(0).toUpperCase() + strategy.slice(1);
        
        console.log('Authenticator ---','In init',strategy);

        if ( ! ( params.consumerKey && params.secret && params.callbackURL && params.callbackStore && self['setUp'+ strategyMethodName]) )
          throw 'Authenticator --- Insufficient Number of Parameters to setup strategy: ' + strategy;

        // call setup method through reflection
        self['setUp'+ strategyMethodName](params.consumerKey,params.secret,params.callbackURL,params.callbackStore);
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
      // double authentication username can be username itself or email
      var jsonData = {
        username : username,
        email : username,
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

Authenticator.prototype.oAuthCallback =  function(token, tokenSecret, profile, done, callbackStore, strategy) {
  var self = this;
  var userRec = callbackStore (token, tokenSecret, profile);
  var completeUsername = profile.username+'-'+strategy.toLowerCase();

  // verify if account has changed
  var testAccountChanged = function (profiles) {
    var result = false;
    if (profiles) {
      profiles.forEach ( function (profile) {
        console.log('auth',profile.provider,profile.token,strategy,token);
        if (profile.provider === strategy.toLowerCase() && profile.token !== token)
          result = true;
      });
    }
    return result;
  };

  nosqld.getUserProfile ({username:completeUsername}, function (err,user) {
    // profile does no exist or should be updated
    // to capitalize string strategy.charAt(0).toUpperCase() + strategy.slice(1)
    console.log('let\'s store',JSON.stringify(user));
    var callback = function (err, success){
      if (success) {
        console.log('Authenticator ---',strategy,'account stored');
      }
      else {
        console.log('Authenticator ---',strategy,'fail while storing account');
      }
    };
    
    if (err || !user) {
      nosqld.store(userRec,callback);
    }
    else if ( testAccountChanged (user.profiles) ) {
      console.log('Authenticator ---',strategy,'account has changes',completeUsername,userRec);
      self.updateProfile(completeUsername,userRec,true,callback);
    }
  });

  // asynchronous verification, for effect...
  process.nextTick(function () {
    console.log('Authenticator ---',strategy,'async verification');
    return done(null, userRec);
  });
}

Authenticator.prototype.setUpTwitter = function (consumerKey,consumerSecret,callbackURL,callbackStore) {
  var self = this;
  console.log('Authenticator ---','In setup twitter');
  //   Use the TwitterStrategy within Passport.
  //   Strategies in passport require a `verify` function, which accept
  //   credentials (in this case, a token, tokenSecret, and Twitter profile), and
  //   invoke a callback with a user object.
  return passport.use(new TwitterStrategy({
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      callbackURL: callbackURL
    },
    function(token, tokenSecret, profile, done) {
      console.log('Authenticator ---','In callback twitter');
      return self.oAuthCallback(token, tokenSecret, profile, done, callbackStore,'twitter'); 
    }
  ));
};

Authenticator.prototype.setUpFacebook = function (clientID,clientSecret,callbackURL,callbackStore) {
  var self = this;
  console.log('Authenticator ---','In setup facebook');
  //   Use the Facebook within Passport.
  //   Strategies in passport require a `verify` function, which accept
  //   credentials (in this case, a token, tokenSecret, and Twitter profile), and
  //   invoke a callback with a user object.
  return passport.use(new FacebookStrategy({
      clientID: clientID,
      clientSecret: clientSecret,
      callbackURL: callbackURL,
      profileFields: ['id', 'displayName', 'photos','username','name']
      picture":{"data":{"url
    },
    function(token, tokenSecret, profile, done) {
      console.log('Authenticator ---','In callback facebook');
      return self.oAuthCallback(token, tokenSecret, profile, done, callbackStore,'facebook'); 
    }
  ));
};

// Authenticator.prototype.register = function (jsonData,res,callback,validator) 
Authenticator.prototype.register = function (req,res,callback,validator) {
  var jsonData = req.body;
  
  // fallback for get
  if (Object.keys(jsonData).length === 0)
    jsonData = url.parse(req.url,true).query;

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
    delete jsonData.password2;
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

Authenticator.prototype.updateStaticProfile = function(req,res,callback,validator) {
  var self = this;
  var jsonData = req.body;
  // fallback for get
  if (Object.keys(jsonData).length === 0)
    jsonData = url.parse(req.url,true).query;

  // define custom validator or fallback
  var validationResult = {}; 
  validationResult.valid = true;
  
  if (jsonData.password && jsonData.password2) {
    validationResult = validator ? validator(jsonData) : this.validateUpdatePassword(jsonData);
  }
   // on validation success store on db
  if (validationResult.valid && req.session.username) {
    delete jsonData.password2;
    self.updateProfile(req.session.username,jsonData,true,callback);
  }
  else {
    callback( {msg : validationResult.reason } );
  }
}

// replace
// true - I want completely replace a profile
// false - I want update an existing social profile
Authenticator.prototype.updateProfile = function(username,dataToUpdate,replace,callback) {
  console.log('Authenticator ---','updating profile for',username);
  if (dataToUpdate.profiles && !replace) { // only social profiles will be updated
    var profiles = dataToUpdate.profiles;
    dataToUpdate = {}; // remove other stuff
    dataToUpdate.profiles = profiles;
  }

  nosqld.updateUser(username,dataToUpdate,callback)   
}

Authenticator.prototype.logout = function(req, res, callback){
  var callback = callback || function (err,done) {    
    res.redirect('/');
  };
  
  req.logout();
  callback(null,true);
};

// dafeult password validator
Authenticator.prototype.validatePassword = function(queryJSON) {
  var validationResult = {}; 
  validationResult.valid = false;
  var alphanumsymb = /^[A-Za-z0-9_#!:\-\+\|]*$/;

  if (queryJSON.password.length < 6) {
    validationResult.reason = 'Password is too short';
    return validationResult; 
  }

  if (!alphanumsymb.test(queryJSON.password)) {
    validationResult.reason = 'Password has invalid characters';
    return validationResult; 
  }
  
  // password confirmation verification
  if (queryJSON.password2) {
    if (!alphanumsymb.test(queryJSON.password2) || queryJSON.password !== queryJSON.password2) {
      validationResult.reason = 'Password comfirmation is wrong';
      return validationResult;
    }
  }

  validationResult.valid = true;
  return validationResult;
};

// dafeult registration validator
// should return JSON for error {field: resason}
Authenticator.prototype.validate = function(queryJSON) {
  var alphanumsymb = /^[A-Za-z0-9_#!:\-\+\|]*$/;
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
   
  // check username & pwd regexp --> alphanumsymb
  if (!alphanumsymb.test(queryJSON.username)){
    validationResult.reason = 'Username has invalid characters';
    return validationResult; 
  }
  
  // check email  
  if (!emailRegExp.test(queryJSON.email)) {
    validationResult.reason = 'Email has invalid characters';
    return validationResult; 
  }
  
  return this.validatePassword(queryJSON);
}

// dafeult update password validator
Authenticator.prototype.validateUpdatePassword = function(queryJSON) {
  // old password verification
  if ( queryJSON.oldPassword === queryJSON.password ) {
    validationResult.reason = 'Password is unchanged';
    return validationResult; 
  }
  
  return this.validatePassword(queryJSON);
};

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
