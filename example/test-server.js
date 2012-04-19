var express = require('express')
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

app.post('/auth', function (req, res) {
  var callback = function(err, user) {
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
  authenticator.login(req,res,callback);
});
