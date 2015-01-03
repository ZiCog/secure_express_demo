// 
// Passport authentication demo.
//
// Built from the presentation by Jason Diamond, "Authentication of Express Node js Applications" 
//     https://www.youtube.com/watch?v=twav6O53zIQ
//
// With aditional advice from Scott Smith,
//     http://scottksmith.com/blog/2014/09/21/protect-your-node-apps-noggin-with-helmet/ 
//

// TODO: Continue with ssl enhancement as per 00:53:00 into the above video.
// TODO: Protect against CSRF with csurf.
// TODO: Use caja input sanitizer

"use strict";

var https = require('https');
var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var expressSession = require("express-session");
var csrf = require('csurf');
var path = require('path');

var passport = require('passport');
var passportLocal = require('passport-local');
var passportHttp = require('passport-http');

var helmet = require('helmet');

var fs = require('fs');


process.title = 'secure_express_demo';

var hskey = fs.readFileSync('test-key.pem');
var hscert = fs.readFileSync('test-cert.pem')

var options = {
    key:  hskey,
    cert: hscert
};

var app = express();
var server = https.createServer(options, app);


// Implement Content Security Policy (CSP) with Helmet
app.use(helmet.csp({
    defaultSrc:  ["'self'"],
    scriptSrc:   [],
    styleSrc:    ["'self'"],
    imgSrc:      [],
    connectSrc:  ["'none'"],
    fontSrc:     [],
    objectSrc:   [],
    mediaSrc:    [],
    frameSrc:    []
// TODO: CSP Violation reporting
}));

// Implement X-XSS-Protection
app.use(helmet.xssFilter());

// Implement X-Frame: Deny
app.use(helmet.xframe('deny'));

// Implement Strict-Transport-Security
// Note: This does not work unless we actually use HTTPS (req.secure = true) 
app.use(helmet.hsts({
    maxAge: 7776000000,      // 90 days
    includeSubdomains: true
}));

// Hide X-Powered-By
app.use(helmet.hidePoweredBy());


app.set('view engine', 'ejs');


app.use(bodyParser.urlencoded({ extended: false}));
app.use(cookieParser());

app.use(expressSession({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure:   true            // This stops our log in working without SSL
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(csrf());


function verifyCredentials(username, password, done) {
    // Pretend this is using a real database!
    console.log("Verifying user:", username, " Password:", password);
    if (username === password) {
        done(null, {id: username, name: username});
    } else {
        done(null, null);
    }
    // done(new Error('ouch!'); // Use if error in database or whatever.
}

passport.use(new passportLocal.Strategy(verifyCredentials));

passport.use(new passportHttp.BasicStrategy(verifyCredentials));

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

// Server static files from our public directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    // TODO: AN IMPORTANT DECISION LIKE isAuthenticated SHOULD NOT BE LEFT TO THE VIEW !
    //       DIFFERENT VIEWS SHOULD BE SELECTED FOR LOGED IN OR LOGED OUT
    res.render('index', {
        isAuthenticated: req.isAuthenticated(),
        user: req.user
    });
});

app.get('/login', function (req, res) {
    res.render('login', {
        csrf: req.csrfToken()
    });
});


app.post('/login', passport.authenticate('local'), function (req, res) {
    res.redirect('/');
});


app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.use('/api', passport.authenticate('basic', { session: false }));

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

server.listen(port, function () {
    console.log('https://127.0.0.1:' + port + '/');
});









