"use strict";

var r = require('rethinkdb');
var async = require('async');

var makeUserStore = function (init) {
    var that = {},

        database = {host: 'localhost', port: 28015, authKey: "", db: "users"},
        db = database.db,
        table = "users",
        index = "username",

        createDatabase = function (connection, callback) {
            async.series([
                // Create database
                function (callback) {
                    r.dbCreate(db).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Database `[a-z,0-9]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Database', db, 'created.');
                            callback(null);
                        }
                    });
                },
                // Create table
                function (callback) {
                    r.tableCreate(table).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Table `[a-z,0-9]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Table', table, 'created.');
                            callback(null);
                        }
                    });
                },
                // Create index 
                function (callback) {
                    r.table(table).indexCreate(index).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Index `[a-z,0-9]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Index', index, 'created.');
                            callback(null);
                        }
                    });
                },
                // Wait for index completion
                function (callback) {
                    r.table(table).indexWait(index).run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else {
                            console.log("Table and index are available...");
                            callback(null);
                        }
                    });
                },
                // Close database conection
                function (callback) {
                    connection.close();
                    callback(null);
                }
            ],
                function (err, results) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
        },

        setUp = function (callback) {
            var connection;
            async.series([
                function (callback) {
                    r.connect(database, function (err, conn) {
                        if (err) {
                            console.log("Connect failed");
                            callback(err);
                        } else {
                            connection = conn;
                            callback(null);
                        }
                    });
                },
                function (callback) {
                    r.table(table).indexWait(index).run(connection, function (err, result) {
                        if (err) {
                            // The database/table/index was not available, create them
                            createDatabase(connection, function (err, result) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null);
                                }
                            });
                        } else {
                            callback(null);
                        }
                    });
                },
                // Close database conection
                function (callback) {
                    connection.close();
                    callback(null);
                }
            ],
                function (err, results) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, null);
                    }
                });
        },

        put = function (user, callback) {
            var connection;
            async.series([
                function (callback) {
                    r.connect(database, function (err, conn) {
                        if (err) {
                            callback(err);
                        } else {
                            connection = conn;
                            callback(null);
                        }
                    });
                },
                function (callback) {
                    r.table(table).getAll(user.username, {index: index}).isEmpty().run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else if (result === true) {
                            callback(null);
                        } else {
                            callback(new Error("User name in use: " + user.username));
                        }
                    });
                },
                function (callback) {
                    r.table(table).insert(user, {returnChanges: true}).run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else if (result.inserted !== 1) {
                            callback(new Error("User insert failed"));
                        } else {
                            callback(null);
                        }
                    });
                },
                // Close database conection
                function (callback) {
                    connection.close();
                    callback(null);
                }
            ],

                function (err, results) {
                    if (err) {
                        callback(err);
                    } else {
                        console.log(results);
                        callback(null, results);
                    }
                });
        },

        get = function (username, callback) {
            var connection,
                cur;

            async.series([
                function (callback) {
                    r.connect(database, function (err, conn) {
                        if (err) {
                            callback(err);
                        } else {
                            connection = conn;
                            callback(null);
                        }
                    });
                },
                function (callback) {
                    r.table("users").getAll(username, {index: "username"}).run(connection, function (err, cursor) {
                        if (err) {
                            callback(err);
                        } else {
                            cur = cursor;
                            callback(null);
                        }
                    });
                },
                function (callback) {
                    cur.toArray(function (err, result) {
                        if (err) {
                            callback(err);
                        } else if (result.length > 1) {
                            callback(new Error("Duplicate found:", username));
                        } else {
                            callback(null, result[0]);
                        }
                    });
                },
                // Close database conection
                function (callback) {
                    connection.close();
                    callback(null);
                }
            ],
                function (err, results) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, results[2]);
                    }
                });
        };

    that.setUp = setUp;
    that.put   = put;
    that.get   = get;

    return that;
};

exports.makeUserStore = makeUserStore;
