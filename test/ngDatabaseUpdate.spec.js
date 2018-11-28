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

    afterEach(function() {

    });

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
            $databaseupdater.initialize(db, updates, logger).then(function (schema_version) {
                logger.log(schema_version);
                done();
            }).catch(function (error) {
                logger.error(error);
            });

            setTimeout(function() {
                $rootScope.$digest();
            }, 100);
        });

        it ('should be able to perform updates twice', (done) => {
            $databaseupdater.initialize(db, updates, logger).then(function () {
                $databaseupdater.initialize(db, updates, logger).then(function (schema_version) {
                    logger.log(schema_version);
                    done();
                }).catch(function(error) {
                    logger.error(error);
                });
                setTimeout(function() {
                    $rootScope.$digest();
                }, 100);
            }).catch(function (error) {
                logger.error(error);
            });

            setTimeout(function() {
                $rootScope.$digest();
            }, 100);
        });
    });
});