var url = require('url')
  , express = require('express')
  , app = express.createServer()
  , MemoryStore = express.session.MemoryStore
  , sessionStore = new MemoryStore()
  , authenticator = require('../lib/authenticator');

authenticator.init();

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ store: sessionStore, secret: 'keyboard cat' }));
  app.use(express.static(__dirname + '/static'));
});

app.listen(3000);

app.get('/', function (req, res) {
  res.redirect('/login.html');
});

app.get('/index.html', function (req, res) {
  res.redirect('/');
});

app.post('/register',  function (req, res) {
  var callback = function (err, success){
    if (success) {
      // store on db
      res.writeHead(200);      
      res.end("Registered\n");
    }
    else {
      var msg = err.msg ? err.msg : ('wrong request\n');
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(msg);
    }
  };      
  authenticator.register(req,res,callback);
});


function login(req, res) {
  var query = url.parse(req.url,true).query;

  // fallback for get
  if (Object.keys(req.body).length === 0)
    req.body = query;

  console.dir (url.parse(req.url,true));

  var callback = function(err, user) {
    if (err) { console.dir(err); return next(err); }
    if (!user) {
      res.writeHead(401);
      res.end("Unauthorized\n");
      return;
    }
    // set username in session
    req.session.username = user.username; 
    if (query.dest) {
      var newPath = decodeURIComponent( query.dest ); 
      console.log("Redirect Path is", newPath);
      res.redirect(newPath);
    }
    else {
      res.writeHead(200);      
      res.end("Authenticated\n");
    }
  };
  authenticator.login(req,res,"local",callback);
};

app.post('/auth', login);

app.all('/acl',simpleAcl, function (req, res) {
  res.writeHead(200);      
  res.end("Authorized\n");
});

function simpleAcl (req,res,next) {
  var thatUrl = url.parse(req.url,true);

  // fallback for get
  if (Object.keys(req.body).length === 0)
    req.body = thatUrl.query;
  
  var unAuth = function () {
    console.log("Will Redirect to", thatUrl.path)
    res.redirect('/login.html?dest=' + encodeURIComponent( thatUrl.path ) );
    //res.writeHead(401);
    //res.end("You are not authorized to access here!\n");
  }
  
  var callback = function(err, user) {
    if (err) { console.dir(err); return next(err); }
    if (!user) {
      unAuth();
      return;
    }
    console.log (req.session.username,user.username)
    if (req.session.username === user.username)
      next();
    else 
      unAuth();
  };

  if (!req.session.username) {
    unAuth();
    return;
  }
  
  // call/query ACL DB
  authenticator.login(req,res,"local",callback);
}

