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

## Usage

