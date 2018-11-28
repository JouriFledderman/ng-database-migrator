// Be descriptive with titles here. The describe and it titles combined read like a sentence.
describe('Database updater', function() {
    var updates = [
        {
            version: 201810230925,
            script: 'CREATE TABLE IF NOT EXISTS Person (id INTEGER PRIMAY, firstname VARCHAR (255))'
        },
        {
            version: 201810230926,
            script: 'CREATE TABLE IF NOT EXISTS Car (id INTEGER PRIMAY KEY, model VARCHAR (255))'
        },
        {
            version: 201810230927,
            script: 'CREATE TABLE IF NOT EXISTS Insurance (id INTEGER PRIMAY KEY, extid VARCHAR (255))'
        }
    ];

    var incorrect_checksum = {
        version: 201810230927,
        script: 'CREATE TABLE IF NOT EXISTS Inrusance (id INTEGER PRIMAY KEY, extid VARCHAR (255))'
    };

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
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230927);
                done();
            }).catch(function (error) {
                logger.error(error);
            });

            _waitAndDigest();
        });

        it ('should handle the same set of updates correctly twice', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230927);
                $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                    expect(schema_version).toEqual(201810230927);
                    done();
                }).catch(function(error) {
                    logger.error(error);
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error);
            });

            _waitAndDigest();
        });

        it ('should return null when already running without interrupting the other', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230927);
            }).catch(function (error) {
                logger.error(error);
            });

            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(null);
                done();
            }).catch(function (error) {
                logger.error(error);
            });

            _waitAndDigest();
        });

        it ('should fail second time when running two completely different changesets', (done) => {
            $databaseupdater.initialize(db, [updates[0], updates[2]], null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230927);
                $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('There was a mismatch between versions in the database and the changeset');
                    done();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error);
            });

            _waitAndDigest();
        });

        it ('should fail second time when running with different checksum', (done) => {
            $databaseupdater.initialize(db, updates, null /* replace me with logger to get console output */).then(function (schema_version) {
                expect(schema_version).toEqual(201810230927);
                $databaseupdater.initialize(db, [updates[0], updates[1], incorrect_checksum], null /* replace me with logger to get console output */).then(function () {
                    logger.error("this should not happen");
                }).catch(function(error) {
                    expect(error.message).toEqual('There was a mismatch between versions in the database and the changeset');
                    done();
                });
                _waitAndDigest();
            }).catch(function (error) {
                logger.error(error);
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