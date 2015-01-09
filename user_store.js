"use strict";


var r = require('rethinkdb');
var async = require('async');

var makeUserStore = function (init) {
    var that = {},

        database = {host: 'localhost', port: 28015, authKey: "", db: "users"},
        connection = null,
        db = database.db,
        table = "users",
        index = "username",
        setupCallback,

        createDatabase = function () {
            async.series([
                // Create users database
                function(callback){
                    r.dbCreate(db).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Database `.*` already exists/))) {
                            console.log("Could not create the database `" + db + "`");
                            console.log(err);
                            process.exit(1);
                        }
                        console.log('Database', db, 'created.');
                        callback(null, 'one');
                    });
                },
                // Create users table
                function(callback){
                    r.tableCreate(table).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Table `.*` already exists/))) {
                            console.log("Could not create the table", table);
                            console.log(err);
                            process.exit(1);
                        }
                        console.log('Table', table, 'created.');
                        callback(null, 'two');
                    });
                },
                // Index the users table
                function(callback){
                    r.table(table).indexCreate(index).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Index `.*` already exists/))) {
                            console.log("Could not create the index", index);
                            console.log(err);
                            process.exit(1);
                        }
                        console.log('Index', index, 'created.');
                        callback(null, 'three');
                    });
                },
                // Wait for index completion
                function(callback){
                    r.table(table).indexWait(index).run(connection, function (err, result) {
                        if (err) {
                            console.log("Could not wait for the completion of the index",  index);
                            console.log(err);
                            process.exit(1);
                        }
                        console.log("Table and index are available...");
                        callback(null, 'four');
                    });
                },
                // Close database conection
                function(callback){
                    connection.close();
                    callback(null, 'five');
                }
            ],
            // 
            function(err, results){
                console.log(results);
                setupCallback();
            });
        },

        setUp = function (callback) {
            setupCallback = callback;
            r.connect(database, function (err, conn) {
                if (err) {
                    console.log("Could not open a connection to initialize the database");
                    console.log(err.message);
                    process.exit(1);
                }
                connection = conn;
                r.table(table).indexWait(index).run(conn, function (err, result) {
                    if (err) {
                        // The database/table/index was not available, create them
                        console.log("No such table");
                        createDatabase();
                    } else {
                        console.log("Table and index are available...");
//                        connection.close();
                        setupCallback();
                    }
                });
            });
        },

        put = function (user, callback) {
            var connection;
            async.series([
                function (callback) {
                    r.connect(database, function (err, conn) {
                        if (err) {
                            console.log("Could not open a connection to put user");
                            console.log(err.message);
                            process.exit(1);
                        } else {
                            connection = conn;
                            callback(null, 'one');
                        }              
                    });
                },
                function (callback) {
                    r.table(table).getAll(user.username, {index: index}).isEmpty().run(connection, function (error, result) {
                        if (error) {
                            console.log ("User isEmpty failed"); 
                            process.exit(1);
                        } else {
                            if (result === true) {
                                callback(null, 'two');
                            } else {
                                console.log ("Username in use!");
                                process.exit(1);
                            } 
                        }
                    });
                },
                function (callback) {
                    console.log ("Inserting new user");
                    r.table(table).insert(user, {returnChanges: true}).run(connection, function(error, result) {
                        if (error) {
                            console.log ("User insert failed 1"); 
                            process.exit(1);
                        } else if (result.inserted !== 1) {
                            console.log ("User insert failed 2");
                            process.exit(1);
                        } else {
                            console.log("User insert OK");
                            callback(null, 'three');
                        }
                    });
                },
                // Close database conection
                function(callback){
                    connection.close();
                    callback(null, 'four');
                }
            ],
            // 
            function(err, results){
                console.log(results);
            });
        },

        get = function (username, callback) {
            console.log ("user.get:", username);
            var connection;
            var cur
            async.series([
                function (callback) {
                    r.connect(database, function (err, conn) {
                        if (err) {
                            console.log("Could not open a connection to get user");
                            console.log(err.message);
                            process.exit(1);
                        } else {
                            connection = conn;
                            callback(null, 'one');
                        }
                    });
                },
                function (callback) {
                    r.table("users").getAll(username, {index: "username"}).run(connection, function(error, cursor) {
                        if (error) {
                            console.log ("User get failed 1");
                            callback(error, null);
                        } else {
                            console.log("User get OK");
                            cur = cursor;
                            callback(null, 'two');
                        }
                    });
                },
                function (callback) {
                    cur.toArray(function(error, result) {
                        if (error) {
                            console.log("cursor to array failed"); 
                            callback(error, null);
                        } else {
                            if (result.length != 1) {
                                // Send back the data
                                callback ("Crappy error", null);
                            } else {
                                callback (null, result[0]);
                            }
                        }
                    });
                },
                // Close database conection
                function(callback){
                    connection.close();
                    callback(null, 'four');
                }
            ],
            // 
            function(err, results){
                if (err) {
                    callback(err, null);
                } else {
                    console.log(results);
                    callback(null, results[2]);
                }
            });
        },

        close = function () {
        };

    that.setUp = setUp;
    that.put   = put;
    that.get   = get;
    that.close = close;

    return that;
};

//var userStore = makeUserStore();
//userStore.setUp(function () {
//    console.log("Set up done");
//});

exports.makeUserStore = makeUserStore;


