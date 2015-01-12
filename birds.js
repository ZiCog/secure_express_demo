"use strict";

var express = require('express');

var router = express.Router();

// Middleware specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
});

// Define the home page route
router.get('/', function(req, res) {
   res.send('Birds home page');
});

// define the about route
router.get('/about', function(req, res) {
    res.send('About birds');
});

module.exports = router;