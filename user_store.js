"use strict";

var makeUserStore = function (init) {
    var that = {},

        r = require('rethinkdb'),
        database = {host: 'localhost', port: 28015, authKey: "", db: "users"},
        connection = null,
        db = database.db,
        table = "users",
        index = "username",
        setupCallback,

        waitForIndex = function () {
            r.table(table).indexWait(index).run(connection, function (err, result) {
                if (err) {
                    console.log("Could not wait for the completion of the index",  index);
                    console.log(err);
                    process.exit(1);
                }
                console.log("Table and index are available...");
//                connection.close();
                setupCallback();
            });
        },

        createIndex = function () {
            r.table(table).indexCreate(index).run(connection, function (err, result) {
                if (err && (!err.message.match(/Index `.*` already exists/))) {
                    console.log("Could not create the index", index);
                    console.log(err);
                    process.exit(1);
                }
                console.log('Index', index, 'created.');
                waitForIndex();
            });
        },

        createTable = function () {
            r.tableCreate(table).run(connection, function (err, result) {
                if (err && (!err.message.match(/Table `.*` already exists/))) {
                    console.log("Could not create the table", table);
                    console.log(err);
                    process.exit(1);
                }
                console.log('Table', table, 'created.');
                createIndex();
            });
        },

        createDatabase = function () {
            r.dbCreate(db).run(connection, function (err, result) {
                if (err && (!err.message.match(/Database `.*` already exists/))) {
                    console.log("Could not create the database `" + db + "`");
                    console.log(err);
                    process.exit(1);
                }
                console.log('Database', db, 'created.');
                createTable();
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
            r.connect(database, function (err, conn) {
                if (err) {
                    console.log("Could not open a connection to put user");
                    console.log(err.message);
                    process.exit(1);
                } else {
                    r.table(table).getAll(user.username, {index: index}).isEmpty().run(conn, function (error, result) {
                        if (error) {
                            console.log ("User isEmpty failed"); 
                        } else {
                            if (result === true) {
                                console.log ("Inserting new user");
                                r.table(table).insert(user, {returnChanges: true}).run(conn, function(error, result) {
                                    if (error) {
                                        console.log ("User insert failed 1"); 
                                    } else if (result.inserted !== 1) {
                                        console.log ("User insert failed 2");
                                    } else {
                                        console.log("User insert OK");
                                    }
                                });
                            } else {
                                console.log ("Username in use!"); 
                            }
                        }
                    });
  
                }
            });
           // TODO: close the connection here somewhere !
        },

        get = function (username, callback) {
            console.log ("user.get:", username);
            r.connect(database, function (err, conn) {
                if (err) {
                    console.log("Could not open a connection to get user");
                    console.log(err.message);
                    process.exit(1);
                } else {
                    r.table("users").getAll(username, {index: "username"}).run(conn, function(error, cursor) {
                        if (error) {
                            console.log ("User get failed 1");
                            callback(error, null);
                        } else {
                            console.log("User get OK");
                            cursor.toArray(function(error, result) {
                                if (error) {
                                    console.log("cursor to array failed"); 
                                    callback(error, null);
                                }
                                else {
                                    if (result.length != 1) {
                                        // Send back the data
                                        callback ("Crappy error", null);
                                    } else {
                                        callback (null, result[0]);
                                    }
                                }
                            });
                        }
                    });
                }
            });
            // TODO: close the connection here somewhere !
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


