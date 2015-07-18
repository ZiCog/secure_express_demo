/*jslint node: true */
"use strict";

let rethink = require('rethinkdb');
let async = require('async');

let makeUserStore = function (init) {
    let pub = {},

        dbOptions = {
            host: init.host,
            port: init.port,
            authKey: init.authKey,
            db:      init.db
        },
        db = dbOptions.db,
        table = init.table,
        index = "username",
        connection,

        createDatabase = function (connection, callback) {
            async.series([

                function createDatabase(callback) {
                    rethink.dbCreate(db).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Database `[a-z,0-9]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Database', db, 'created.');
                            callback(null);
                        }
                    });
                },

                function createTable(callback) {
                    rethink.tableCreate(table).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Table `[a-z,0-9,\.]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Table', table, 'created.');
                            callback(null);
                        }
                    });
                },

                function createIndex(callback) {
                    rethink.table(table).indexCreate(index).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Index `[a-z,0-9]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Index', index, 'created.');
                            callback(null);
                        }
                    });
                },
                // Wait for index completion
                function waitIndex(callback) {
                    rethink.table(table).indexWait(index).run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else {
                            console.log("Table and index are available...");
                            callback(null);
                        }
                    });
                }
            ],
            function asyncDone(err, results) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        },

        setUp = function (callback) {
            async.series([

                function connect(callback) {
                    let reopenConnection = function () {
                        rethink.connect(dbOptions, function (err, conn) {
                            if (err) {
                                console.log("Connect failed", err);
                                setTimeout(reopenConnection, 1000);
                            } else {
                                console.log("Connect OK");
                                connection = conn;

                                conn.addListener('error', function (e) {
                                    console.log("Connection error", e);
                                    connection.close();
                                });

                                conn.addListener('close', function () {
                                    console.log("\nConnection closed!");
                                    connection.removeAllListeners();
                                    setTimeout(reopenConnection, 1000);
                                });
                            }
                        });
                    };

                    rethink.connect(dbOptions, function (err, conn) {
                        if (err) {
                            console.log("Connect failed", err);
                            callback(err);
                        } else {
                            console.log("Connect OK");
                            connection = conn;

                            conn.addListener('error', function (e) {
                                console.log("Connection error", e);
                                connection.close();
                            });

                            conn.addListener('close', function () {
                                console.log("\nConnection closed!");
                                connection.removeAllListeners();
                                setTimeout(reopenConnection, 1000);
                            });
                            callback(null);
                        }
                    });
                },

                function checkExists(callback) {
                    rethink.table(table).indexWait(index).run(connection, function (err, result) {
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
                }
            ],
            function asyncDone(err, results) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        },

        put = function (user, callback) {
            async.series([

                function checkDuplicate(callback) {
                    rethink.table(table).getAll(user.username, {index: index}).isEmpty().run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else if (result === true) {
                            callback(null);
                        } else {
                            callback(new Error("User name in use: " + user.username));
                        }
                    });
                },
                function insert(callback) {
                    rethink.table(table).insert(user, {returnChanges: true}).run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else if (result.inserted !== 1) {
                            callback(new Error("User insert failed"));
                        } else {
                            callback(null);
                        }
                    });
                }
            ],
            function asyncDone(err, results) {
                if (err) {
                    callback(err);
                } else {
                    console.log(results);
                    callback(null, results);
                }
            });
        },

        get = function (username, callback) {
            let cur;

            async.series([
                function get(callback) {
                    rethink.table("users").getAll(username, {index: index}).run(connection, function (err, cursor) {
                        if (err) {
                            callback(err);
                        } else {
                            cur = cursor;
                            callback(null, "OK");
                        }
                    });
                },
                function asArray(callback) {
                    cur.toArray(function (err, result) {
                        if (err) {
                            callback(err);
                        } else if (result.length > 1) {
                            callback(new Error("Duplicate found:", username));
                        } else {
                            callback(null, result[0]);
                        }
                    });
                }
            ],
            function asyncDone(err, results) {
                console.log("Get results:", results);
                if (err) {
                    callback(err);
                } else {
                    callback(null, results[1]);
                }
            });
        };

    pub.setUp = setUp;
    pub.put   = put;
    pub.get   = get;

    return pub;
};

exports.makeUserStore = makeUserStore;
