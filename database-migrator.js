(function(window, angular) {'use strict';

angular.module('ngDatabaseMigrator').

factory('$databasemigrator', $databasemigrator);

DatabaseMigrator.$inject = [];

function DatabaseMigrator() {

    /**
     * @param database - the database to validate the migrations against
     * @param updates - a list with schema version updates consisting of the following fields
     * {
     *     version: number - the version of the script
     *     script: string - the actual sqlite updatescript
     * }
     */
    function initialize(database, updates, logger) {
        _transaction(database, function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER, checksum INTEGER)", [], function () {
                tx.executeSql("SELECT * FROM schema_version ORDER BY version DESC LIMIT 1", [], function(tx, results) {
                    var schemaversion = 0;
                    if (results.rows.length === 1) {
                        schemaversion = _construct(results.rows.item(0));
                    }
                    if (_checksumvalid(tx, schemaversion, updates)) {
                        _updateSchema(tx, schemaversion, updates);
                    }
                });
            });
        });
    }

    /**
     * function to get a transaction from the provided database
     * @param database - the provided database
     * @param fn - callback function
     */
    function _transaction(database, fn) {
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
        return { version: row['version'], checksum: row['checksum']};
    }

    /**
     * Function to check if the checksums of previous updates are still valid
     * @param tx - database transaction
     * @param schemaVersion - current schema version
     */
    function _checksumvalid(tx, schemaVersion, updates) {
        var checksumvalid = true;

        var previouslyExecutedUpdates = updates.filter(function(update) {
            return update.version <= schemaVersion;
        }).sort((a, b) => {
            return (a.version > b.version) ? 1 : (b.version > a.version) ? -1 : 0;
        });

        if (executedUpdates.length > 0) {
            checksumvalid = _updatevalid(tx, previouslyExecutedUpdates, 0);
        }
        return checksumvalid;
    }

    /**
     * function to check if a single update contain still matches the checksum with which it was added to the database
     * @param tx - the current database transaction
     * @param updates - the full set of database updates
     * @param updateIndex - the current update index
     * @returns {boolean} - whether the update was successfull or not
     */
    function _updatevalid(tx, updates, updateIndex) {
        var valid = false;
        var currentUpdate = updates[updateIndex];

        tx.executeSql("SELECT * FROM schema_version WHERE version=? LIMIT 1", [currentUpdate.version], function (tx, results) {
            if (results.rows.length == 1) {
                var schemaVersion = _construct(results.rows.item(0));
                if (schemaVersion.checksum === _checksum(currentUpdate.script)) {
                    updateIndex++;
                    if (updates.length > updateIndex) {
                        valid = _updatevalid(updates, updateIndex);
                    } else {
                        valid = true;
                    }
                }
            }
        });

        return valid;
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
            chr   = string.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
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
        var pendingUpdates = updates.filter(function(update) {
            return update.version > schemaVersion;
        }).sort((a, b) => {
            return (a.version > b.version) ? 1 : (b.version > a.version) ? -1 : 0;
        });

        if (pendingUpdates.length > 0) {
            _executeUpdate(tx, pendingUpdates, 0);
        }
    }

    /**
     * function to execute a single database update
     * @param tx - the current database transaction
     * @param updates - the list of updates
     * @param updateIndex - the current update index
     */
    function _executeUpdate(tx, updates, updateIndex) {
        tx.executeSql(currentUpdate.script, [], function(tx, results) {
            tx.executeSql("INSERT INTO schema_version (version, checksum) VALUES(?, ?)", [currentUpdate.version, $database.getChecksum(currentUpdate.script)], function(tx, results) {
                updateIndex++;
                if (updates.length > updateIndex) {
                    return _executeUpdate(promise, updates, updateIndex);
                }
            });
        })
    }

    return {
        initialize: initialize
    }
}
})();
