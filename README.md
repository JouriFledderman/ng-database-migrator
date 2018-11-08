# ng-database-updater

## Description
In the backend there are lots of tools helping you update your database safely to the next version, such as Liquibase
or FlywayDB). When you look at the frontend frameworks there is significantly less tooling available. But it is not 
unthinkable to have an SQLite database running in an app, or on a website. And it is thus not unthinkable that this 
database should be updated as well at a certain moment. ng-database-updater is a plugin that helps you do this in a 
safe and secure way.

It will automatically create a schema_version table for your SQLite database and it will verify which of the sql updates
is already executed and which of the updates is still pending. From the already executed scripts it will check if the 
checksum is still valid, to make sure that the updatescripts did not change over time and in that way to be sure that 
in case the database needs to be recreated, the same scripts are executed in the same manner. It will run all pending updates
with a newer version then the current database version. And each update will be added to the schema_version table, so it will 
be verified for its checksum next time and it will not be executed again. 

## Installation

### Bower
run: `bower install git+https://github.com/JouriFledderman/ng-database-update.git` and add the plugin to your `index.html` file. 

## Usage
When you add the ngDatabaseUpdate module to your angularJS project the $databaseupdater becomes available. It is then possible to inject this somewhere in your project. In order to check for and execute updates, run the initialize function. This aync function needs the following arguments: database, set of updates, logger

#### Database
The first thing it needs is a database it can read from and write to. You can obtain a connection to an SQLite database in javascript by running the following command: window.openDatabase('testDatabase', '1.0', 'testDatabase', 2 * 1024 * 1024).

#### Updates
The second thing it needs is an array of updates. An update has a specific format within this framework. It is a simple object that contains a version and a script field. The version is a number and is used to determine which script is newer, a good practice would be to add a timestamp (yyyyMMddHHmm -> 201811081506) as a version of the script. Chances are very slim that two scripts will be added at the same minute and the newest script is alway executed latest. The script is a string and contains the SQLite script. 

#### Logger (Optional)
The third argument is a logger, in order for your application to log something about what is going on. You can use for example the default $log from angular. If you do not provide a logger, the code should still work, but it will simply not log about it.
