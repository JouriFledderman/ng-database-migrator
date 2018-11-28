(function () {
    'use strict';

    angular.module('ngDatabaseUpdater', []);

    angular.module('ngDatabaseUpdater').factory('$databaseupdater', ['$q', function ($q) {

        /* stored logger during an update */
        let _logger = null;

        /* stored db during an update */
        let _database = null;

        /* To make sure that we cannot run the initialize function while we are already running this function */
        let _active = false;

        return {
            initialize: initialize
        };

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
            _log('debug', "DATEBASEUPDATER.INITIALIZE()");

            let defer = $q.defer();
            if (!_active) {
                _active = true;
                _logger = logger;
                _database = database;

                _transaction(_database, function (tx) {
                    tx.executeSql("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL PRIMARY KEY, checksum INTEGER NOT NULL)", [], function () {
                        _log('info', "Schema version table initialized");
                        _log('info', "Obtaining schema version...");

                        tx.executeSql("SELECT * FROM schema_version ORDER BY version DESC", [], function (tx, results) {
                            let resultArr = _convertResultSetToArray(results);
                            let schemaVersion = 0;
                            if (resultArr.length > 0) {
                                schemaVersion = resultArr[0].version;
                            }

                            _log('info', "Schema is currently at version " + schemaVersion);
                            _log('info', "Checking for updates...");

                            if (_checksumvalid(schemaVersion, updates, resultArr)) {
                                _updateSchema(schemaVersion, updates).then(function (updateVersion) {
                                    if (schemaVersion === updateVersion) {
                                        _log('info', 'No updates found! Schema is up to date');
                                    } else {
                                        _log('info', 'Schema updated from version ' + schemaVersion + ' to ' + updateVersion);
                                    }
                                    _tearDown();
                                    defer.resolve();
                                }).catch(function (error) {
                                    defer.reject(error);
                                });
                            } else {
                                defer.reject();
                            }
                        });
                    });
                }, function (error) {
                    _log('info', 'Something went wrong while updating the database');
                    _log('error', error.message);

                    _tearDown();
                    defer.reject();
                });
            } else {
                _log('info', 'Updater is already running, skipping updates');
                defer.resolve();
            }

            return defer.promise;
        }

        /**
         * simple function that resets the value to what they should be
         * @private
         */
        function _tearDown() {
            _logger = null;
            _database = null;
            _active = false;
        }

        /**
         * function to get a transaction from the provided database
         * @param database - the provided database
         * @param fn - callback function
         * @param error - error callback
         * @param success - the success callback
         * @private
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
         * @private
         */
        function _construct(row) {
            return {version: row['version'], checksum: row['checksum']};
        }

        /**
         * Function to check if the checksums of previous updates are still valid
         * @param updates - the full set of database updates
         * @param results - the already executed scripts from the database schema_version table
         * @param schemaVersion - current schema version
         * @private
         */
        function _checksumvalid(schemaVersion, updates, results) {
            let updatesValid = true;

            let previouslyExecutedUpdates = updates.filter(function (update) {
                return update.version <= schemaVersion;
            }).sort((a, b) => {
                return (a.version > b.version) ? 1 : (b.version > a.version) ? -1 : 0;
            });

            let disjuntionResults = _compare(results, previouslyExecutedUpdates);
            let disjuntionUpdates = _compare(previouslyExecutedUpdates, results);

            if (disjuntionResults.length > 0 || disjuntionUpdates.length > 0) {
                if (disjuntionResults.length > 0) {
                    _log('error', 'the following updates were found current set of updates, but not in the in the database: ' + disjuntionResults)
                }
                if (disjuntionUpdates.length > 0) {
                    _log('error', 'the following updates were found in the database, but not in the current set of updates: ' + disjuntionUpdates)
                }
                updatesValid = false;
            } else {

                if (results != null && results.length > 0) {
                    results.forEach(function(result) {
                        let update = updates.filter(item => item.version === result.version)[0];
                        if (result.checksum !== _checksum(update.script)) {
                            _log('error', 'Incorrect checksum found for script with version ' + update.version + '. File has checksum ' + _checksum(update.script) + ' while database has checksum ' + result.checksum);
                            updatesValid = false;
                        } else {
                            _log('info', 'Checksum is valid for script with version ' + update.version);
                        }
                    });
                }
            }

            if (updatesValid) {
                _log('info', 'All checksums are valid');
            }

            return updatesValid;
        }

        /**
         * Check if an array contains items that another array does not contain
         * @param arr1 - the first array for the comparison
         * @param arr2 - the second array for the comparison
         * @returns {Array}
         * @private
         */
        function _compare(arr1, arr2) {
            let disjunction = [];

            if ((arr1 == null && arr2 == null) || (arr1.length === 0 && arr2.length === 0)) {
                // DO NOTHING
            } else {
                arr1.map(item => item.version).forEach(function(item1) {
                    if (!arr2.map(item => item.version).includes(item1)) {
                        disjunction.push(item1);
                    }
                });
            }

            return disjunction;
        }

        /**
         * Convert a mysqlite resultset to an array
         * @param resultSet - the given mysqlite resultset
         * @returns {Array}
         * @private
         */
        function _convertResultSetToArray(resultSet) {
            let resultArray = [];
            for (let i = 0; i < resultSet.rows.length; i++) {
                let row = _construct(resultSet.rows.item(i));
                resultArray.push(row);
            }
            return resultArray;
        }

        /**
         * function to obtain the checksum from a string
         * @param string - the provided string
         * @returns {number} - the checksum
         * @private
         */
        function _checksum(string) {
            let hash = 0, i, chr;
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
         * @param schemaVersion - the database schema version before the update
         * @param updates - the list of updates
         * @private
         */
        function _updateSchema(schemaVersion, updates) {
            let defer = $q.defer();

            let pendingUpdates = updates.filter(function (update) {
                return update.version > schemaVersion;
            }).sort((a, b) => {
                return (a.version > b.version) ? 1 : (b.version > a.version) ? -1 : 0;
            });

            if (pendingUpdates.length > 0) {
                _executeUpdate(defer, pendingUpdates, 0);
            } else {
                defer.resolve(schemaVersion);
            }

            return defer.promise;
        }

        /**
         * function to execute a single database update
         * @param promise - the current promise
         * @param updates - the list of updates
         * @param updateIndex - the current update index
         * @private
         */
        function _executeUpdate(promise, updates, updateIndex) {
            let currentUpdate = updates[updateIndex];

            _transaction(_database, function (tx) {
                tx.executeSql(currentUpdate.script, [], function (tx, results) {
                    tx.executeSql("INSERT INTO schema_version (version, checksum) VALUES(?, ?)", [currentUpdate.version, _checksum(currentUpdate.script)], function (tx, results) {
                        _log('info', 'Successfully updated database to version ' + currentUpdate.version);

                        updateIndex++;
                        if (updates.length > updateIndex) {
                            _executeUpdate(promise, updates, updateIndex);
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
            }, function(error) {
                _log('error', error.message);
                promise.reject(error);
            })
        }

        /**
         * function to log a message at a certain level with the provided logger
         * @param level - the loglevel at which the message is logged
         * @param message - the message that is logged
         * @private
         */
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
    }]);
})();
