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

/*jslint node: true */
"use strict";

let https          = require('https');
let express        = require('express');
let bodyParser     = require('body-parser');
let cookieParser   = require('cookie-parser');
let expressSession = require('express-session');
let csrf           = require('csurf');
let path           = require('path');
let passport       = require('passport');
let passportLocal  = require('passport-local');
let passportHttp   = require('passport-http');
let helmet         = require('helmet');
let fs             = require('fs');
let pw             = require('credential');
let async          = require('async');

let makeUserStore  = require('./user_store.js');

// SETUP
// ==============================================

process.title = 'secure_express_demo';

/*jslint stupid: true*/
let hskey  = fs.readFileSync('test-key.pem');
let hscert = fs.readFileSync('test-cert.pem');
/*jslint stupid: false*/

let options = {
    key:  hskey,
    cert: hscert
};

let app = express();
let server = https.createServer(options, app);

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

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());

app.use(expressSession({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge:  3600000,     // 1 Hour
        httpOnly:   true,
        secure:     true      // This stops our log in working without SSL
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(csrf());

function verifyCredentials(username, password, done) {
    console.log("Verifying user:", username, " Password:", password);
    let foundUser;
    async.series([
        function (callback) {
            users.get(username, function (err, user) {
                if (err) {
                    console.log("Error finding");
                    callback(err);
                } else if (user) {
                    console.log("Found user", user.username);
                    foundUser = user;
                    callback(null);
                } else {
                    callback(new Error("User not found"));
                }
            });
        },
        function (callback) {
            pw.verify(foundUser.passwordHash, password, function (err, isValid) {
                if (err) {
                    callback(err);
                } else if (isValid) {
                    console.log('Passwords match');
                    callback(null, {id: username, name: username});
                } else {
                    console.log('Wrong password.');
                    callback(new Error('Incorrect password', null));
                }
            });
        }
    ],
        function (err, results) {
            console.log(results);
            if (err) {
                done(null, false);
            } else {
                done(null, {id: username, name: username});
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




// APPLICATION ROUTES
// ==============================================

// Get an instance of router
let router = express.Router();


router.get('/', function (req, res) {
    // TODO: AN IMPORTANT DECISION LIKE isAuthenticated SHOULD NOT BE LEFT TO THE VIEW !
    //       DIFFERENT VIEWS SHOULD BE SELECTED FOR LOGED IN OR LOGED OUT
    res.render('index', {
        isAuthenticated: req.isAuthenticated(),
        user: req.user
    });
});

router.get('/register', function (req, res) {
    res.render('register', {
        csrf: req.csrfToken()
    });
});

router.post('/register', function (req, res) {
    console.log("Register: ", req.body.email, req.body.username, req.body.password);

    pw.hash(req.body.password, function (err, hash) {
        if (err) {
            throw err;
        }
        let user = {};
        user.username = req.body.username;
        user.passwordHash = hash;
        user.email = req.body.email;
        users.put(user, function (err) {
            if (err) {
                console.log("user.put failed", err);
            }
        });
    });
    res.redirect('/');
});

router.get('/login', function (req, res) {
    res.render('login', {
        csrf: req.csrfToken()
    });
});

router.post('/login', passport.authenticate('local'), function (req, res) {
    res.redirect('/');
});

router.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

router.get('/spa', ensureAuthenticated, function (req, res) {
    res.render('spa', {
        csrf: req.csrfToken()
    });
});

// Apply the routes to our application
app.use('/', router);

// API ROUTES
// ==============================================

// Get an instance of router
let apiRouter = express.Router();

apiRouter.use(passport.authenticate('basic', { session: false }));

apiRouter.get('/data', ensureAuthenticated, function (req, res) {
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
apiRouter.get('/logout', function (req, res) {
    res.sendStatus(401);
});

// Apply the routes to our application
app.use('/api', apiRouter);

// BIRDS ROUTES
// ==============================================

let birds = require('./birds');

app.use(ensureAuthenticated);

app.use('/birds', birds);


// START THE SERVER
// ==============================================

let port = process.env.PORT || 1337;

let userStoreOptions = {
    host:    "localhost",
    port:    "28015",
    authKey: "",
    db:      "users",
    table:   "users"
};
let users = makeUserStore.makeUserStore(userStoreOptions);

users.setUp(function (err, result) {
    if (err) {
        console.log("Users setup failed:", err);
    } else {
        console.log("Users set up done");
        server.listen(port, function () {
            console.log('https://127.0.0.1:' + port + '/');

        });
    }
});
