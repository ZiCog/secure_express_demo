"use strict";

var UserStore = function (init) {
    var that = {};

    var r = require('rethinkdb'),
        connection = null,
        db = "users",
        table = "users",
        index = "username",
        setupCallback,

        waitForIndex = function () {
            r.table(table).indexWait(index).run(connection, function(err, result) {
                if (err) {
                    console.log("Could not wait for the completion of the index",  index);
                    console.log(err);
                    process.exit(1);
                }
                console.log('Index', index, 'ready.');
                console.log("Table and index are available...");
                connection.close();
                setupCallback();
            });
        },

        createIndex = function () {
            r.table(table).indexCreate(index).run(connection, function(err, result) {
                if ((err) && (!err.message.match(/Index `.*` already exists/))) {
                    console.log("Could not create the index", index);
                    console.log(err);
                    process.exit(1);
                }
                console.log('Index', index, 'created.');
                waitForIndex();
            });
        },

        createTable = function () {
            r.tableCreate(table).run(connection, function(err, result) {
                if ((err) && (!err.message.match(/Table `.*` already exists/))) {
                    console.log("Could not create the table `todos`");
                    console.log(err);
                    process.exit(1);
                }
                console.log('Table', table, 'created.');
                createIndex();
            });
        },

        createDatabase = function () {
            r.dbCreate(db).run(connection, function(err, result) {
                if ((err) && (!err.message.match(/Database `.*` already exists/))) {
                    console.log("Could not create the database `"+config.db+"`");
                    console.log(err);
                    process.exit(1);
                }
                console.log('Database', db, 'created.');
                createTable();
            });
        },

        setUp = function (callback) {
            setupCallback = callback;
            r.connect( {host: 'localhost', port: 28015, authKey: "", db: db}, function(err, conn) {
                if (err) {
                    console.log("Could not open a connection to initialize the database");
                    console.log(err.message);
                    process.exit(1);
                }
                connection = conn;
                r.table(table).indexWait(index).run(conn, function(err, result) {
                    if (err) {
                        // The database/table/index was not available, create them
                        console.log("No such table");
                        createDatabase();
                    } else {
                        console.log("Table and index are available...");
                        connection.close();
                        setupCallback();
                    }
                });
            })
        },

        close = function () {
        };

    that.setUp = setUp;
    that.close = close;

    return that;
}

var userStore = UserStore ();

userStore.setUp(function () {
    console.log ("Set up done");
});

