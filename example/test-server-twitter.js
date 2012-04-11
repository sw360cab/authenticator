var express = require('express')
  , app = express.createServer()
  , passport = require('passport')
  , MemoryStore = express.session.MemoryStore
  , sessionStore = new MemoryStore()
  , authenticator = require('../lib/authenticator');

var TWITTER_CONSUMER_KEY = 'bpezPISte59LrAkmvTcoJQ';
var TWITTER_CONSUMER_SECRET = 'YZ88fMfswDLbQL0Aotaz5lDUT1wToMEQViJaPBZg5Y';
var CALLBACK_URI = 'http://twitter.minimalgap.com:3000/auth/twitter/callback';

authenticator.init({ 
  "twitter" : {
    name : "twitter",
    consumerKey: TWITTER_CONSUMER_KEY,
    secret: TWITTER_CONSUMER_SECRET,
    callbackURL: CALLBACK_URI,
    callbackStore: function (token, tokenSecret, profile){
      //JSON with information for storage
      return {
        username : profile.username+'twitter',
        email: profile.emails[0].value,
        displayName : profile.displayName,
        accountType : "social",
        imageUrl : profile._json.profile_image_url,
        profiles : [{ 
          provider : "twitter",
          token : token,
          tokenSecret : tokenSecret,
          socialId : profile.id,
          displayName : profile.displayName,
          email: profile.emails[0].value,
          imageUrl :  profile._json.profile_image_url
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

// GET /auth/twitter
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to twitter.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/twitter/callback
app.get('/auth/twitter',function(req, res) {
  authenticator.login( req,res,"twitter")
});

// GET /auth/twitter/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/twitter/callback', function(req, res) {
    authenticator.login( req,res,"twitter", function(err, done) {
      if (err){
        res.writeHead(401,'text/plain');
        res.end("Unauthorized by twitter");
        return;
      }        
      res.writeHead(200,'text/plain');
      res.end("Finished authenticating twitter");
    });
});
