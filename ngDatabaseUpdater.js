(function () {
    'use strict';

    angular.module('ngDatabaseUpdater', []);

    angular.module('ngDatabaseUpdater').

    factory('$databaseupdater', ['$q', function($q) {

        var _logger = null;

        /* we do not want this function to be call */
        var _active = false;

        /**
         * @param database - the database to validate the updates against
         * @param updates - a list with schema version updates consisting of the following fields
         * {
         *     version: number - the version of the script
         *     script: string - the actual sql(ite) updatescript
         * }
         * @param logger - a logger
         */
        function initialize(database, updates, logger) {
            var defer = $q.defer();

            if (!_active) {
                _logger = logger;
                _active = true;

                _log('debug', "DATEBASEUPDATER.INITIALIZE()");
                _transaction(database,
                    function (tx) {
                        tx.executeSql("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER, checksum INTEGER)", [], function () {

                            _log('info', "Schema version table initialized");
                            _log('info', "Obtaining schema version...");

                            tx.executeSql("SELECT * FROM schema_version ORDER BY version DESC LIMIT 1", [], function (tx, results) {
                                var schemaVersion = 0;
                                if (results.rows.length === 1) {
                                    schemaVersion = _construct(results.rows.item(0)).version;
                                }

                                _log('info', "Schema is currently at version " + schemaVersion);
                                _log('info', "Checking for updates...");

                                _checksumvalid(tx, schemaVersion, updates).then(function () {
                                    _updateSchema(tx, schemaVersion, updates).then(function (updateVersion) {
                                        if (schemaVersion === updateVersion) {
                                            _log('info', 'No updates found! Schema is up to date');
                                        } else {
                                            _log('info', 'Schema updated from version ' + schemaVersion + ' to ' + updateVersion);
                                        }
                                        defer.resolve();
                                    }).catch(function (error) {
                                        defer.reject(error);
                                    });
                                }).catch(function (error) {
                                    defer.reject(error);
                                });
                            });
                        });
                    }, function (error) {
                        _log('info', 'Something went while updating the database');
                        _log('error', error.message);

                        _logger = null;
                        _active = false;
                        defer.reject();
                    }, function () {
                        _logger = null;
                        _active = false;
                    });
            } else {
                defer.resolve();
            }

            return defer.promise;
        }

        /**
         * function to get a transaction from the provided database
         * @param database - the provided database
         * @param fn - callback function
         */
        function _transaction(database, fn, error, success) {
            if ((database !== undefined) && (database != null)) {
                database.transaction(fn, error, success);
            }
        }

        /**
         * function to construct a schermaversion object from a row
         * @param row - the database row
         * @returns {{version: *, checksum: *}}
         */
        function _construct(row) {
            return {version: row['version'], checksum: row['checksum']};
        }

        /**
         * Function to check if the checksums of previous updates are still valid
         * @param tx - database transaction
         * @param schemaVersion - current schema version
         */
        function _checksumvalid(tx, schemaVersion, updates) {
            var defer = $q.defer();

            var previouslyExecutedUpdates = updates.filter(function (update) {
                return update.version <= schemaVersion;
            }).sort((a, b) => {
                return (a.version > b.version) ? 1 : (b.version > a.version) ? -1 : 0;
            });

            if (previouslyExecutedUpdates.length > 0) {
                _updatevalid(defer, tx, previouslyExecutedUpdates, 0);
            } else {
                defer.resolve();
            }

            return defer.promise;
        }

        /**
         * function to check if a single update contain still matches the checksum with which it was added to the database
         * @param tx - the current database transaction
         * @param updates - the full set of database updates
         * @param updateIndex - the current update index
         * @returns {boolean} - whether the update was successfull or not
         */
        function _updatevalid(promise, tx, updates, updateIndex) {
            var currentUpdate = updates[updateIndex];

            tx.executeSql("SELECT * FROM schema_version WHERE version=? LIMIT 1", [currentUpdate.version], function (tx, results) {
                if (results.rows.length == 1) {
                    var schemaVersion = _construct(results.rows.item(0));
                    if (schemaVersion.checksum === _checksum(currentUpdate.script)) {
                        _log('info', 'Checksum still valid for script with version ' + currentUpdate.version);

                        updateIndex++;
                        if (updates.length > updateIndex) {
                            _updatevalid(promise, tx, updates, updateIndex);
                        } else {
                            _log('info', 'All checksums still valid');
                            promise.resolve();
                        }
                    } else {
                        _log('error', 'Incorrect checksum found for script with version ' + currentUpdate.version + '. File has checksum ' + _checksum(currentUpdate.script) + ' while database has checksum ' + schemaVersion.checksum);
                        promise.reject();
                    }
                } else {
                    _log('error', 'No record found in the database for script with version ' + currentUpdate.version);
                    promise.reject();
                }
            });
        }

        /**
         * function to obtain the checksum from a string
         * @param string - the provided string
         * @returns {number} - the checksum
         */
        function _checksum(string) {
            var hash = 0, i, chr;
            if (string.length === 0) return hash;
            for (i = 0; i < string.length; i++) {
                chr = string.charCodeAt(i);
                hash = ((hash << 5) - hash) + chr;
                hash |= 0;
            }
            return hash;
        }

        /**
         * function to collect the new scripts and initialize the update
         * @param tx - the current database transaction
         * @param schemaVersion - the database schema version before the update
         * @param updates - the list of updates
         */
        function _updateSchema(tx, schemaVersion, updates) {
            var defer = $q.defer();

            var pendingUpdates = updates.filter(function (update) {
                return update.version > schemaVersion;
            }).sort((a, b) => {
                return (a.version > b.version) ? 1 : (b.version > a.version) ? -1 : 0;
            });

            if (pendingUpdates.length > 0) {
                _executeUpdate(defer, tx, pendingUpdates, 0);
            } else {
                defer.resolve(schemaVersion);
            }

            return defer.promise;
        }

        /**
         * function to execute a single database update
         * @param tx - the current database transaction
         * @param updates - the list of updates
         * @param updateIndex - the current update index
         */
        function _executeUpdate(promise, tx, updates, updateIndex) {
            var currentUpdate = updates[updateIndex];

            tx.executeSql(currentUpdate.script, [], function (tx, results) {
                tx.executeSql("INSERT INTO schema_version (version, checksum) VALUES(?, ?)", [currentUpdate.version, _checksum(currentUpdate.script)], function (tx, results) {
                    _log('info', 'Successfully updated database to version ' + currentUpdate.version);

                    updateIndex++;
                    if (updates.length > updateIndex) {
                        _executeUpdate(tx, updates, updateIndex);
                    } else {
                        promise.resolve(currentUpdate.version);
                    }
                }, function (error) {
                    _log('info', 'Something went wrong while inserting version ' + currentUpdate.version + ' into schema version table, this should not happen!');
                    _log('error', error.message);
                    promise.reject(error);
                });
            }, function (error) {
                _log('info', 'Something went wrong while updating database to ' + currentUpdate.version + ', update was not executed');
                _log('error', error.message);
                promise.reject(error);
            })
        }

        function _log(level, message) {
            if (_logger !== null && _logger !== undefined) {
                switch (level) {
                    case 'error':
                        _logger.error(message);
                        break;
                    case 'info':
                        _logger.info(message);
                        break;
                    case 'debug':
                        _logger.debug(message);
                        break;
                    case 'warn':
                        _logger.warn(message);
                        break;
                    default:
                        _logger.debug(message);
                }
            }
        }

        return {
            initialize: initialize
        }
    }]);
})();
