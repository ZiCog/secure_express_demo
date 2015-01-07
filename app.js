// 
// Passport authentication demo.
//
// Built from the presentation by Jason Diamond, "Authentication of Express Node js Applications" 
//     https://www.youtube.com/watch?v=twav6O53zIQ
//
// With aditional advice from Scott Smith,
//     http://scottksmith.com/blog/2014/09/21/protect-your-node-apps-noggin-with-helmet/ 
//

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

var pw = require('credential');

var makeUserStore = require("./user_store.js");
var users = makeUserStore.makeUserStore();


var newUsername = 'pi';
var newPassword = 'pi';
var newEmail;
var storedHash = "";
 

process.title = 'secure_express_demo';

/*jslint stupid: true*/
var hskey = fs.readFileSync('test-key.pem');
var hscert = fs.readFileSync('test-cert.pem');
/*jslint stupid: false*/

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
    console.log("Verifying user:", username, " Password:", password);
    users.get(username, function (err, user) {
        if (err) {
            console.log("Error looking up user");
            done(null, null);
        } else {
            console.log("Found user", user.username);
            pw.verify(user[0].passwordHash, password, function (err, isValid) {
                if (err) {
                    console.log ("Error verifying hash: ", err);
                    done(null, null);
                    //done(new Error('ouch!'));                     // Use if error in database or whatever.
                } else {
                    if (isValid) {
                        console.log ('Passwords match');
                        done(null, {id: username, name: username});
                    } else {
                        console.log ('Wrong password.');
                        done(null, null);
                    }
                }
            });
        }
    });
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
    console.log("ensureAuhenticated:");
    if (req.isAuthenticated()) {
        next();
    } else {
        res.sendStatus(403);
    }
}

// Server static files from our public directory
/*jslint nomen: true*/
app.use(express.static(path.join(__dirname, 'public')));
/*jslint nomen: false*/

app.get('/', function (req, res) {
    // TODO: AN IMPORTANT DECISION LIKE isAuthenticated SHOULD NOT BE LEFT TO THE VIEW !
    //       DIFFERENT VIEWS SHOULD BE SELECTED FOR LOGED IN OR LOGED OUT
    res.render('index', {
        isAuthenticated: req.isAuthenticated(),
        user: req.user
    });
});

app.get('/register', function (req, res) {
    res.render('register', {
        csrf: req.csrfToken()
    });
});

app.post('/register', function (req, res) {
    console.log ("Register: ", req.body.email, req.body.username, req.body.password);
    newUsername = req.body.username;
    newPassword = req.body.password;
    newEmail    = req.body.email;

    pw.hash(newPassword, function (err, hash) {
        if (err) { throw err; }
        storedHash = hash;
        var user = {};
        user.username = req.body.username;
        user.passwordHash = hash;
        user.email = req.body.email;
        users.put(user, function (err) {
            if (err) {
                console.log ("user.put failed");
            }
        });
    });
    res.redirect('/');
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

users.setUp(function () {
    console.log("users set up done");
    server.listen(port, function () {
        console.log('https://127.0.0.1:' + port + '/');
    });
});









