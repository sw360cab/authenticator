var express = require('express')
  , app = express.createServer()
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , MemoryStore = express.session.MemoryStore
  , sessionStore = new MemoryStore();

var nosqld = require('../lib/nosqld/nosqld');
//nosqld.configure();
nosqld.init();

passport.use(new LocalStrategy(
  function(username, password, done) {  // verify callback
    var jsonData = {
      username : username,
      password : password
    };

    // validate 
    var validationResult = validate(jsonData);  
    if (validationResult.valid)       
       nosqld.verifyCredentials(jsonData,done);
    else 
      return done(null,false);
  }
));

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ store: sessionStore, secret: 'keyboard cat' }));
  app.use(express.static(__dirname + '/static'));
});

app.listen(3000);

app.get('/', function (req, res) {
   res.sendfile(__dirname + '/login.html');
});

app.get('/index.html', function (req, res) {
   res.redirect('/')
});


/*
 * Invia messaggio di post con dati da registrare 
 * 
 *
 */
app.post('/auth',  function (req, res) {
  console.dir(req.body);
  // If this function gets called, authentication was successful.
  // `req.user` property contains the authenticated user.
  passport.authenticate('local', function(err, user) {
    if (err) { console.dir(err); return next(err); }
    if (!user) {
      res.writeHead(401);
      res.end("\n");
      return;
    }
    // set username in session
    req.session.username = user.username; 
    res.writeHead(200);      
    res.end("\n");
  })(req, res);
});
  



// should return JSON for error {(field: resason)*}
var validate = function(queryJSON) {
  var validationResult = {};
  
  var valid = true
  
  if (! (queryJSON.username && queryJSON.password) ) {
    validationResult.reason = 'Insufficient Number of Parameters';
    valid = false; 
  }
  // set valid field
  if (valid)
    validationResult.valid = true;
  
  return validationResult;
};



