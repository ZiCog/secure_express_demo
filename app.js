// 
// Passport authentication demo.
//
// Built from the presentation by Jason Diamond https://www.youtube.com/watch?v=twav6O53zIQ
//

//"use strict";

var express = require ("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var expressSession = require("express-session");


var passport = require('passport');
var passportLocal = require('passport-local');


var app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false}));
app.use(cookieParser());
app.use(expressSession({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new passportLocal.Strategy(function (username, password, done) {
    if (username === password) {
        done(null, {id:username, name: username});
    } else {
        done(null, null);
    }
    // done(new Error('ouch!'); // Use if error in database or whatever.
}));


passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
     // Query database or cache here
     done(null, { id: id, name: id });
});

app.get('/', function(req, res) {
     res.render('index', {
         isAuthenticated: req.isAuthenticated(),
         user: req.user
     });
});

app.get('/login', function(req, res) {
    res.render('login');
});


app.post('/login', passport.authenticate('local'), function(req, res) {
    res.redirect('/');
});


app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

var port = process.env.PORT || 1337;

app.listen (port, function() {
    console.log('http://127.0.0.1:' + port + '/');
});









