var express = require('express')
  , app = express.createServer()
  , MemoryStore = express.session.MemoryStore
  , sessionStore = new MemoryStore();

var nosqld = require('../lib/nosqld/nosqld');
//nosqld.configure();
nosqld.init();

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ store: sessionStore, secret: 'keyboard cat' }));
  app.use(express.static(__dirname + '/static'));
});

app.listen(3000);

app.get('/', function (req, res) {
   res.sendfile(__dirname + '/register.html');
});

app.get('/index.html', function (req, res) {
   res.redirect('/')
});


/*
 * Invia messaggio di post con dati da registrare 
 * 
 *
 */
app.post('/register',  function (req, res) {
  var fullBody;

  console.dir(req.body);
  var callback = function (err, success){
    if (success) {
      // store on db
      res.writeHead(200);      
      res.end("\n");
    }
    else {
      var msg = err.msg ? err.msg : ('wrong request\n');
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(msg);
    }
  };      
  doRegistration(req.body,callback);
});

var doRegistration = function (jsonData,callback,validator) { // validate 
  var validationResult = validator ? validator(jsonData) : validate(jsonData);
  
  if (validationResult.valid) {
    nosqld.store(jsonData,callback)
   }
  else {
    callback( {msg : validationResult.reason } );
  }
}


// should return JSON for error {(field: resason)*}
var validate = function(queryJSON) {
  var alphanum = /^[A-Za-z0-9_]*$/;
  var emailRegExp = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  var validationResult = {};
  
  var valid = true
  
  if (! (queryJSON.username && queryJSON.password && queryJSON.email) ) {
    validationResult.reason = 'Insufficient Number of Parameters';
    valid = false; 
  }

  // check username & pwd length
  if (queryJSON.username.length < 3) {
    validationResult.reason = 'Username is too short';
    valid = false; 
  }
    
  if (queryJSON.password.length < 6) {
    validationResult.reason = 'Password is too short';
    valid = false; 
  }
   
  // check username & pwd regexp --> alphanum
  if (!alphanum.test(queryJSON.username)){
    validationResult.reason = 'Username has invalid characters';
    valid = false; 
  }
  
  if (!alphanum.test(queryJSON.password)) {
    validationResult.reason = 'Password has invalid characters';
    valid = false; 
  }

  // check email  
  if (!emailRegExp.test(queryJSON.email)) {
    validationResult.reason = 'Password has invalid characters';
    valid = false; 
  }
  
  // set valid field
  if (valid)
    validationResult.valid = true;
  
  return validationResult;
}



