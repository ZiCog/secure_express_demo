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
var passportHttp = require('passport-http');

process.title = 'passport-demo';

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

passport.use(new passportLocal.Strategy(verifyCredentials));

passport.use(new passportHttp.BasicStrategy(verifyCredentials));

function verifyCredentials (username, password, done) {
    // Pretend this is using a real database!
    if ((username === 'pi') && (password === 'pi')) {
        done(null, {id: username, name: username});
    } else {
        done(null, null);
    }
    // done(new Error('ouch!'); // Use if error in database or whatever.
}


passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
     // Query database or cache here
     done(null, { id: id, name: id });
});


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.sendStatus(403);
    }
}

app.get('/', function(req, res) {
     // TODO: AN IMPORTANT DECISION LIKE isAuthenticated SHOULD NOT BE LEFT TO THE VIEW !
     //       DIFFERENT VIEWS SHOULD BE SELECTED FOR LOGED IN OR LOGED OUT
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

app.use('/api', passport.authenticate('basic'));

app.get('/api/data', ensureAuthenticated, function (req, res) {
    res.json([
        {value: 'foo'},
        {value: 'bar'},
        {value: 'baz'},
        {value: 'wtf'},
        {value: 'omg'}
    ]);
});


// Note: This logout is a work around for the fact the Chrome, FF, etc seem to remeber basic 
//       auth credentials and they are hard to clear from the browser.
//       http://stackoverflow.com/questions/4163122/http-basic-authentication-log-out
app.get('/api/logout', function (req, res) {
    res.sendStatus(401);
});

var port = process.env.PORT || 1337;

app.listen (port, function() {
    console.log('http://127.0.0.1:' + port + '/');
});









