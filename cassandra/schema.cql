DROP KEYSPACE chat;

CREATE KEYSPACE chat WITH replication = {'class': 'SimpleStrategy', 'replication_factor' : 3};

USE chat;

CREATE TABLE Messages(
	id timeuuid,
	username text,
	text text,
	expiration_date timestamp,
	PRIMARY KEY(username, id));
CREATE INDEX ON messages (id);

CREATE TABLE ExpiredMessages(
	id timeuuid,
	username text,
	text text,
	expiration_date timestamp,
	PRIMARY KEY(username, id));
CREATE INDEX ON expiredmessages (id);