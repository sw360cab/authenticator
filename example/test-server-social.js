var express = require('express')
  , app = express.createServer()
  , passport = require('passport')
  , MemoryStore = express.session.MemoryStore
  , sessionStore = new MemoryStore()
  , authenticator = require('../lib/authenticator');

var TWITTER_CONSUMER_KEY = 'v2CiGGU9O3S6F4TwgXsbQg';
var TWITTER_CONSUMER_SECRET = '2k0pDCvLAChSHUOFi3IGYwabrJz1gUaoHtgU0klNaU';
var TWITTER_CALLBACK_URI = 'http://social.citybugs.it:3000/auth/twitter/callback';

var FACEBOOK_APP_ID = '227159640730685';
var FACEBOOK_APP_SECRET = 'c6b6e5bccfef1a5db8e2bbf5eba57bfe';
var FACEBOOK_CALLBACK_URI = 'http://social.citybugs.it:3000/auth/facebook/callback';

authenticator.init({ 
  "nosqld" : {   
    dbms : "couchd",
  },
  "twitter" : {
    name : "twitter",
    consumerKey: TWITTER_CONSUMER_KEY,
    secret: TWITTER_CONSUMER_SECRET,
    callbackURL: TWITTER_CALLBACK_URI,
    callbackStore: function (token, tokenSecret, profile){
      //JSON with information for storage
      return {
        username : profile.username+'-twitter',
        displayName : profile.displayName,
        accountType : "social",
        imageUrl : profile._json.profile_image_url,
        profiles : [{ 
          provider : "twitter",
          token : token,
          tokenSecret : tokenSecret,
          socialId : profile.id,
          displayName : profile.displayName,
          imageUrl : profile._json.profile_image_url
        }]
      }
    }
  },
  "facebook" : {
    name : "facebook",
    consumerKey: FACEBOOK_APP_ID,
    secret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URI,
    callbackStore: function (token, tokenSecret, profile,done){
      console.log("facebook's tokens",token,tokenSecret,JSON.stringify(profile))
      //JSON with information for storage
      return {
        username : profile.username+'-facebook',
        displayName : profile.displayName,
        accountType : "social",
        profiles : [{ 
          provider : "facebook",
          token : token,
          tokenSecret : tokenSecret,
          socialId : profile.id,
          displayName : profile.displayName,
        }]
      }
    }
  }
});

var app = express.createServer();

// configure Express
app.configure(function() {
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

app.listen(3000);

app.get('/', function(req, res){
  res.redirect('/auth/twitter');
});


app._handleSocial = function(req,res,err,done,strategy) {
    console.log("social is " + strategy);
    var failure = function () {      
      res.statusCode = 401;
      res.setHeader( 'Content-Type', 'text/plain' );
      return;
    };

    var success = function () {
      if (!req.session.username)
        req.session.username = done.username;
      console.log("the session username",req.session.username)

      res.statusCode = 200;
      res.setHeader( 'Content-Type', 'text/plain' );
      res.end("Finished authenticating " + strategy);
      return;
    };

    if (err){
      failure();
      return;
    }

    if (req.session.username){
      console.log('time for update',req.session.username)

      authenticator.updateProfile (req.session.username,done,false, function (err,done) {
        console.log('time for update')
        done ? success () : failure();
      });
    }
    else
      success();
}


// GET /auth/twitter
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to twitter.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/twitter/callback
app.get('/auth/twitter',function(req, res) {
  authenticator.login( req,res,"twitter");
});

// GET /auth/twitter/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/twitter/callback', function(req, res) {
  authenticator.login( req,res,"twitter", function(err, done) {
    app._handleSocial(req,res,err,done,"twitter");
  });
});

// GET /auth/facebook
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to facebook.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/facebook/callback
app.get('/auth/facebook',function(req, res) {
  authenticator.login( req,res,"facebook")
});

// GET /auth/facebook/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/facebook/callback', function(req, res) {
 authenticator.login( req,res,"facebook", function(err, done) {
    app._handleSocial(req,res,err,done,"facebook");
  });
});

