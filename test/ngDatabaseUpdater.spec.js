// Be descriptive with titles here. The describe and it titles combined read like a sentence.
describe('Test DatabaseUpdater', function() {
    var updates = [
        {
            version: 201810230925,
            script: 'CREATE TABLE IF NOT EXISTS Person (id INTEGER PRIMARY KEY, firstname VARCHAR (255))'
        },
        {
            version: 201810230926,
            script: 'CREATE TABLE IF NOT EXISTS Car (id INTEGER PRIMARY KEY, model VARCHAR (255))'
        },
        {
            version: 201810230927,
            script: 'CREATE TABLE IF NOT EXISTS Insurance (id INTEGER PRIMARY KEY, extid VARCHAR (255))'
        },
        {
            version: 201810230928,
            script: 'INSERT INTO Insurance(id, extid) VALUES(200, \'abcdefghijklmn\')'
        }
    ];

    var lower_version = {
        version: 201704121212,
        script: 'CREATE TABLE IF NOT EXISTS Dog (id INTEGER PRIMARY KEY, extid VARCHAR (255))'
    };

    var incorrect_checksum = {
        version: 201810230927,
        script: 'CREATE TABLE IF NOT EXISTS Inrusance (id INTEGER PRIMARY KEY, extid VARCHAR (255))'
    };

    var drop_table = {
        version: 201810230930,
        script: 'DROP TABLE Insurance;DROP TABLE Inrurance;'
    };

    var select_script = {
        version: 201810230931,
        script: 'SELECT * FROM Insurance WHERE id=200;'
    }


    var $databaseupdater, $q, $rootScope, db, logger, guid;

    beforeEach(module('ngDatabaseUpdater'));
    beforeEach(inject(function(_$databaseupdater_,_$q_, _$rootScope_){
        $databaseupdater = _$databaseupdater_;
        logger = console;
        guid = Math.random();
        db = openDatabase(guid, '1.0', guid, 2 * 1024 * 1024);
        $rootScope = _$rootScope_;
        $q = _$q_;
    }));

    it('factory should exist', function() {
        expect($databaseupdater).toBeDefined();
    });

    it('database should exist', function() {
        expect(db).toBeDefined();
    });

    it('logger should exist', function() {
        expect(logger).toBeDefined();
    });

    describe('.initialize()', function() {
        it('should be able to perform default updates', (done) => {
            $databaseupdater.initialize(db, [lower_version, updates[0], updates[1], updates[2], updates[3]], null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
                done();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });

        it ('should handle the same set of updates correctly twice (once executing the scripts and once skipping them after checksum validation)', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
                $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                    expect(schema_version).toEqual(201810230928);
                    done();
                }).catch(function(error) {
                    logger.error(error.message);
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });

        it ('should return null when already running without interrupting the first run', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
            }).catch(function (error) {
                logger.error(error.message);
            });

            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(null);
                done();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });

        it ('should fail second time when script is missing in the changeset', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
                $databaseupdater.initialize(db, [updates[0], updates[2]], null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('The following updates were found in the database, but not in the current set of updates: 201810230928,201810230926');
                    done();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });


        it ('should fail second time when script is missing in the database', (done) => {
            $databaseupdater.initialize(db, [updates[0], updates[2]], null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230927);
                $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('The following updates were found current set of updates, but not in the in the database: 201810230926');
                    done();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });

        it ('should fail second time when running because checksum does not match', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
                $databaseupdater.initialize(db, [updates[0], updates[1], incorrect_checksum, updates[3]], null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('Incorrect checksum found for script with version 201810230927. File has checksum 2015242007 while database has checksum -1043481897');
                    done();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });

        it ('should fail second time when running unknown script with lower version number', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
                $databaseupdater.initialize(db, [updates[0], updates[1], updates[2], lower_version], null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('The following updates were found current set of updates, but not in the in the database: 201704121212');
                    done();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });

        it ('should revert complete transaction of partially incorrect script', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230928);
                $databaseupdater.initialize(db, [updates[0], updates[1], updates[2], updates[3], drop_table], null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('Something went wrong while updating database to 201810230930, update was not executed');
                    $databaseupdater.initialize(db, [updates[0], updates[1], updates[2], updates[3], select_script], null /* replace me with logger to get console output */).then(function (schema_version) {
                        expect(schema_version).toEqual(201810230931);
                        done();
                    });
                    _waitAndDigest();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error.message);
            });

            _waitAndDigest();
        });
    });

    function _waitAndDigest() {
        setTimeout(function() {
            $rootScope.$digest();
        }, 100);
    }
});