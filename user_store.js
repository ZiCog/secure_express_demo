"use strict";

var r = require('rethinkdb');
var async = require('async');

var makeUserStore = function (init) {
    var pub = {},

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
                    r.dbCreate(db).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Database `[a-z,0-9]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Database', db, 'created.');
                            callback(null);
                        }
                    });
                },

                function createTable(callback) {
                    r.tableCreate(table).run(connection, function (err, result) {
                        if (err && (!err.message.match(/Table `[a-z,0-9,\.]*` already exists/))) {
                            callback(err);
                        } else {
                            console.log('Table', table, 'created.');
                            callback(null);
                        }
                    });
                },

                function createIndex(callback) {
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
                function waitIndex(callback) {
                    r.table(table).indexWait(index).run(connection, function (err, result) {
                        if (err) {
                            callback(err);
                        } else {
                            console.log("Table and index are available...");
                            callback(null);
                        }
                    });
                },
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
                    var maintainConnection = function () {
                    };

                    r.connect(dbOptions, function (err, conn) {
                        if (err) {
                            console.log("Connect failed", err);
                            callback(err);
                        } else {
                            console.log("Connect OK");
                            connection = conn;

                            connection.addListener('error', function (e) {
                                console.log("Connection error", e);
                            });

                            connection.addListener('close', function () {
                                console.log("Connection closed!");
                            });
                            callback(null);
                        }
                    });

                },

                function checkExists(callback) {
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
            ],
                function asyncDone(err, results) {
                    if (err) {
                        callback(err);
                    } else {
                        console.log(results);
                        callback(null);
                    }
                });
        },

        put = function (user, callback) {
            async.series([

                function checkDuplicate(callback) {
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
                function insert(callback) {
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
            var cur;

            async.series([
                function get(callback) {
                    r.table("users").getAll(username, {index: index}).run(connection, function (err, cursor) {
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
                },
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
